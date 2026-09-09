import Cart from '../../models/cart.model.js';
import Wishlist from '../../models/wishlist.model.js';
import Merchant from '../../models/merchant.model.js';
import mongoose from 'mongoose';
import Collection from '../../models/collection.model.js';
import ProductFlat from '../../models/productFlat.model.js';
import { generateColorVariantId, convertToLegacyFormat } from '../../utils/variantAdapter.js';
import { body, validationResult } from 'express-validator'

/**
 * Helper: Groups flat products by styleGroupId and picks first color variant
 * to produce card-level data (one card per product group).
 * Returns an array of objects shaped like: { _id (styleGroupId), name, merchantId, ... firstVariantFields }
 */
const flatToCardData = (flatProducts, req) => {
  // Group by styleGroupId
  const groups = {};
  flatProducts.forEach(p => {
    const key = p.styleGroupId;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  return Object.values(groups).map(siblings => {
    const first = siblings[0]; // representative doc (first color/size)
    return {
      _id: first.styleGroupId,
      name: first.name,
      merchantId: first.merchantId?._id || first.merchantId,
      brandId: first.brandId,
      categoryId: first.categoryId,
      subCategoryId: first.subCategoryId,
      gender: first.gender || [],
      ratings: first.ratings || 0,
      numReviews: first.numReviews || 0,
      variantId: generateColorVariantId(first.styleGroupId, first.color?.name),
      price: first.price,
      mrp: first.mrp,
      discount: first.discount || 0,
      images: first.images,
      color: first.color,
      isTriable: first.isTriable !== false,
      isInstantBuyable: calculateIsInstantBuyable(first.styleGroupId, first.merchantId?._id || first.merchantId, req.nearbyMerchantIds),
      isWarehouseListing: false,
      source: 'shop',
    };
  });
};

/**
 * Helper to check if a product is instant buyable (within T&B radius and merchant active/online).
 */
const calculateIsInstantBuyable = (productId, merchantId, nearbyMerchantIds, merchantStatus = {}) => {
  const nearbySet = new Set(nearbyMerchantIds?.map(id => id.toString()) || []);
  const isNearby = nearbySet.has(merchantId?.toString());
  
  // If merchantStatus is provided (e.g. from populate), use it. 
  // Otherwise, if nearby, we assume it's true (since resolveNearbyMerchants already filters by status).
  const isOnline = merchantStatus.isOnline !== undefined ? merchantStatus.isOnline : true;
  const isZoneLive = merchantStatus.isZoneLive !== undefined ? merchantStatus.isZoneLive : true;
  
  return isNearby && isOnline && isZoneLive;
};

export const newArrivals = async (req, res) => {
  try {
    const { gender } = req.query;

    const flatFilter = {
      isActive: true,
      isDeleted: { $ne: true },
      createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 90)) },
    };

    if (req.nearbyMerchantIds) {
      const onlineMerchantIds = await Merchant.find({
        _id: { $in: req.nearbyMerchantIds },
        isOnline: true, isZoneLive: true
      }).select('_id').lean();
      flatFilter.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
    }
    if (gender && gender !== 'All') flatFilter.gender = gender;

    const flatProducts = await ProductFlat.find(flatFilter).sort({ createdAt: -1 }).lean();
    return res.status(200).json(flatToCardData(flatProducts, req));
  } catch (error) {
    console.error('Error in newArrivals:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

export const productsDetails = async (req, res) => {
  try {
    const flatProductDoc = await ProductFlat.findOne({
      $or: [{ _id: req.params.id }, { styleGroupId: req.params.id }],
      isActive: true
    })
      .populate('brandId', 'name logo')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('subSubCategoryId', 'name')
      .populate('warehouseId', 'name code supportsTryAndBuy supportsCourier operatingHours')
      .populate({ 
        path: 'merchantId', 
        select: 'shopName logo isVerified isActive address isOnline isZoneLive', 
      })
      .populate('attributes.attributeId', 'name');

    if (!flatProductDoc) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const siblings = await ProductFlat.find({
      styleGroupId: flatProductDoc.styleGroupId,
      isActive: true,
      isDeleted: { $ne: true }
    });

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
    const merchantIdStr = flatProductDoc.merchantId?._id?.toString() || flatProductDoc.merchantId?.toString();
    const isNearby = merchantIdStr ? nearbySet.has(merchantIdStr) : false;

    const isInstantBuyable = flatProductDoc.merchantId ? calculateIsInstantBuyable(flatProductDoc.styleGroupId, flatProductDoc.merchantId._id || flatProductDoc.merchantId, req.nearbyMerchantIds, {
      isOnline: flatProductDoc.merchantId.isOnline,
      isZoneLive: flatProductDoc.merchantId.isZoneLive
    }) : false;

    const allVariants = siblings.map(s => {
      const doc = s.toObject ? s.toObject() : s;
      return {
        ...doc,
        colorVariantId: generateColorVariantId(flatProductDoc.styleGroupId, doc.color?.name || 'Default')
      };
    });

    const isWarehouse = flatProductDoc.source === 'warehouse';
    let isWarehouseAvailable = isWarehouse;
    let whId = flatProductDoc.warehouseId?._id || flatProductDoc.warehouseId || null;
    let whName = flatProductDoc.warehouseId?.name || "FlashFits Hub";

    if (!isWarehouse) {
      const whTwin = await ProductFlat.findOne({
        $or: [
          ...(flatProductDoc.sourceProductId ? [{ styleGroupId: flatProductDoc.sourceProductId }] : []),
          { sourceProductId: flatProductDoc.styleGroupId },
          { name: flatProductDoc.name, source: 'warehouse' }
        ],
        source: 'warehouse',
        isActive: true,
        isDeleted: { $ne: true }
      }).populate('warehouseId').lean();

      if (whTwin) {
        isWarehouseAvailable = true;
        whId = whTwin.warehouseId?._id || whTwin.warehouseId || null;
        whName = whTwin.warehouseId?.name || "FlashFits Hub";
      }
    }

    let matchingProductsCards = [];
    if (flatProductDoc.matchingProducts && flatProductDoc.matchingProducts.length > 0) {
      const matchingFlatProducts = await ProductFlat.find({
        styleGroupId: { $in: flatProductDoc.matchingProducts },
        isActive: true,
        isDeleted: { $ne: true }
      }).lean();
      matchingProductsCards = flatToCardData(matchingFlatProducts, req);
    }

    const fulfillmentOptions = {
      flashmart: {
        available: isWarehouseAvailable,
        estimatedTime: "45 Mins",
        label: "FlashMart Express",
        warehouseId: whId,
        warehouseName: whName,
      },
      directStore: {
        available: !isWarehouse && isInstantBuyable && isNearby,
        estimatedTime: "45-60 Mins",
        label: "Direct Store",
        shopName: flatProductDoc.merchantId?.shopName || "Partner Shop",
        merchantId: flatProductDoc.merchantId?._id || flatProductDoc.merchantId,
      },
      courier: {
        available: true,
        estimatedTime: "2-4 Days",
        label: "Standard Courier",
      },
    };

    return res.status(200).json({
      _id: flatProductDoc.styleGroupId,
      styleGroupId: flatProductDoc.styleGroupId,
      name: flatProductDoc.name,
      brandId: flatProductDoc.brandId,
      categoryId: flatProductDoc.categoryId,
      subCategoryId: flatProductDoc.subCategoryId,
      subSubCategoryId: flatProductDoc.subSubCategoryId,
      merchantId: flatProductDoc.merchantId,
      warehouseId: flatProductDoc.warehouseId,
      gender: flatProductDoc.gender,
      description: flatProductDoc.description,
      isTriable: flatProductDoc.isTriable,
      ratings: flatProductDoc.ratings || 0,
      numReviews: flatProductDoc.numReviews || 0,
      isActive: flatProductDoc.isActive,
      isVerified: flatProductDoc.isVerified,
      source: flatProductDoc.source || 'shop',
      isWarehouseListing: isWarehouse,
      attributes: flatProductDoc.attributes,
      variants: allVariants,
      matchingProducts: matchingProductsCards,
      isInstantBuyable,
      isNearby,
      fulfillmentOptions,
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// ── Trending Products ──
export const trendingProducts = async (req, res) => {
  try {
    const { gender } = req.query;

    const flatFilter = { isActive: true, isDeleted: { $ne: true } };
    if (req.nearbyMerchantIds) {
      const onlineMerchantIds = await Merchant.find({
        _id: { $in: req.nearbyMerchantIds }, isOnline: true, isZoneLive: true
      }).select('_id').lean();
      flatFilter.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
    }
    if (gender && gender !== 'All') flatFilter.gender = gender;

    const flatProducts = await ProductFlat.find(flatFilter)
      .sort({ numReviews: -1, ratings: -1 }).lean();
    const cards = flatToCardData(flatProducts, req).slice(0, 15);
    return res.status(200).json(cards);
  } catch (error) {
    console.error('Error in trendingProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

// ── Recommended Products (You May Like) ──
export const recommendedProducts = async (req, res) => {
  try {
    const { gender } = req.query;
    const userId = req.user?.userId;

    let subCategoryIds = [];
    let excludedProductIds = [];

    if (userId) {
      // 1. Get recent Cart items
      const cart = await Cart.findOne({ userId }).lean();
      if (cart && cart.items) {
        excludedProductIds.push(...cart.items.map(i => i.productId));
      }

      // 2. Get recent Wishlist items
      const wishlist = await Wishlist.find({ userId }).select('productId').lean();
      if (wishlist.length > 0) {
        excludedProductIds.push(...wishlist.map(w => w.productId));
      }
    }

    if (excludedProductIds.length > 0) {
      const userFlatProducts = await ProductFlat.find({ styleGroupId: { $in: excludedProductIds.map(id => id.toString()) } })
        .select('subCategoryId').lean();
      userFlatProducts.forEach(p => {
        if (p.subCategoryId) subCategoryIds.push(p.subCategoryId.toString());
      });
      subCategoryIds = [...new Set(subCategoryIds)];
    }

    const flatFilter = { isActive: true, isDeleted: { $ne: true } };
    if (req.nearbyMerchantIds) {
      const onlineMerchantIds = await Merchant.find({
        _id: { $in: req.nearbyMerchantIds }, isOnline: true, isZoneLive: true
      }).select('_id').lean();
      flatFilter.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
    }
    if (gender && gender !== 'All') flatFilter.gender = gender;
    if (excludedProductIds.length > 0) flatFilter.styleGroupId = { $nin: excludedProductIds.map(id => id.toString()) };
    if (subCategoryIds.length > 0) flatFilter.subCategoryId = { $in: subCategoryIds };

    let flatProducts = await ProductFlat.find(flatFilter).limit(100).lean();
    let cards = flatToCardData(flatProducts, req).slice(0, 15);

    if (cards.length < 5) {
      delete flatFilter.subCategoryId;
      flatProducts = await ProductFlat.find(flatFilter).sort({ createdAt: -1 }).limit(100).lean();
      cards = flatToCardData(flatProducts, req).slice(0, 15);
    }

    return res.status(200).json(cards);
  } catch (error) {
    console.error('Error in recommendedProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

/**
 * ─── Robust Filtered Products with Pagination ───
 * Supports: search, pagination, gender (MEN/WOMEN/KIDS/UNISEX),
 * deliveryMode (tryAndBuy/courier), categories, subCategories,
 * price range, colors, stores, sorting.
 */
export const getFilteredProducts = async (req, res) => {
  try {
    const {
      search = '',
      page = 1,
      limit = 20,
      gender,
      deliveryMode,        // "tryAndBuy" | "courier" | null
      priceRange = [],
      selectedCategoryIds = [],
      subCategoryIds = [],
      selectedColors = [],
      selectedStores = [],
      sortBy = 'newest',
      collectionId,
    } = req.body;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;


      const flatMatch = { isActive: true, isDeleted: { $ne: true } };

      // Delivery mode
      if (deliveryMode === 'tryAndBuy') {
        const onlineMerchantIds = await Merchant.find({
          _id: { $in: req.nearbyMerchantIds || [] }, isOnline: true, isZoneLive: true
        }).select('_id').lean();
        flatMatch.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
      } else if (deliveryMode === 'courier') {
        const courierMerchants = await Merchant.find({ enableCourierDelivery: true, isActive: true, isVerified: true }).select('_id').lean();
        const courierIds = courierMerchants.map(m => m._id);
        if (req.nearbyMerchantIds && req.nearbyMerchantIds.length > 0) {
          const nearbySet = new Set(req.nearbyMerchantIds.map(id => id.toString()));
          const courierOnlyIds = courierIds.filter(id => !nearbySet.has(id.toString()));
          if (courierOnlyIds.length === 0) return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
          flatMatch.merchantId = { $in: courierOnlyIds };
        } else {
          flatMatch.merchantId = { $in: courierIds };
        }
      } else {
        if (req.nearbyMerchantIds) {
          const courierMerchants = await Merchant.find({ enableCourierDelivery: true, isActive: true, isVerified: true }).select('_id').lean();
          const nearbySet = new Set(req.nearbyMerchantIds.map(id => id.toString()));
          const courierOnlyIds = courierMerchants.map(m => m._id).filter(id => !nearbySet.has(id.toString()));
          flatMatch.merchantId = { $in: [...req.nearbyMerchantIds, ...courierOnlyIds] };
        }
      }

      // Gender
      if (gender) {
        if (gender === 'UNISEX') flatMatch.gender = { $all: ['MEN', 'WOMEN'] };
        else flatMatch.gender = gender;
      }

      // Store filter
      if (selectedStores?.length > 0) {
        const storeObjectIds = selectedStores.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        if (storeObjectIds.length > 0) {
          if (flatMatch.merchantId) {
            flatMatch.merchantId = { $in: flatMatch.merchantId.$in.filter(nearId => storeObjectIds.some(selId => selId.equals(nearId))) };
            if (flatMatch.merchantId.$in.length === 0) return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
          } else {
            flatMatch.merchantId = { $in: storeObjectIds };
          }
        }
      }

      // Category filter
      if (selectedCategoryIds.length > 0) {
        const validCatIds = selectedCategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        if (validCatIds.length > 0) flatMatch.$or = [{ categoryId: { $in: validCatIds } }, { subCategoryId: { $in: validCatIds } }];
      }
      if (subCategoryIds.length > 0) {
        const validSubIds = subCategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        if (validSubIds.length > 0) flatMatch.subCategoryId = { $in: validSubIds };
      }

      // Collection filter
      if (collectionId) {
        let colObjId = null;
        if (mongoose.Types.ObjectId.isValid(collectionId)) {
          colObjId = new mongoose.Types.ObjectId(collectionId);
        } else {
          const colDoc = await Collection.findOne({ slug: collectionId }).select('_id').lean();
          if (colDoc) colObjId = colDoc._id;
        }
        if (colObjId) {
          flatMatch.collectionIds = colObjId;
        }
      }

      // Search
      if (search.trim() !== '') {
        const searchRegex = new RegExp(search.trim(), 'i');
        flatMatch.$or = [
          ...(flatMatch.$or || []),
          { name: searchRegex }, { tags: searchRegex }, { 'color.name': searchRegex },
          { styleName: searchRegex }
        ];
      }

      // Price & color variant-level filters
      if (priceRange.length === 2) { flatMatch.price = { $gte: priceRange[0], $lte: priceRange[1] }; }
      if (selectedColors.length > 0) { flatMatch['color.name'] = { $in: selectedColors }; }

      // Aggregation: group by styleGroupId, pick first variant, paginate
      const sortOptions = {
        newest: { _id: -1 }, oldest: { _id: 1 }, priceLowToHigh: { price: 1 }, priceHighToLow: { price: -1 },
        discount: { discount: -1 }, rating: { ratings: -1 }, trending: { numReviews: -1 }, relevance: { _id: -1 },
        price_low: { price: 1 }, price_high: { price: -1 },
      };
      const sortKeys = Array.isArray(sortBy) ? sortBy : [sortBy];
      let flatSort = {};
      sortKeys.forEach(key => { if (sortOptions[key]) Object.assign(flatSort, sortOptions[key]); });
      if (Object.keys(flatSort).length === 0) flatSort = { _id: -1 };

      const flatPipeline = [
        { $match: flatMatch },
        { $sort: { styleGroupId: 1, ...flatSort } },
        { $group: {
          _id: '$styleGroupId',
          doc: { $first: '$$ROOT' },
        }},
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: flatSort },
        { $lookup: { from: 'merchants', localField: 'merchantId', foreignField: '_id', as: 'merchantDoc', pipeline: [{ $project: { shopName: 1, isOnline: 1, isZoneLive: 1 } }] } },
        { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brandDoc', pipeline: [{ $project: { name: 1 } }] } },
        { $facet: {
          products: [
            { $skip: skip }, { $limit: limitNum },
            { $project: {
              _id: '$styleGroupId',
              name: 1, merchantId: 1, brandId: 1, categoryId: 1, subCategoryId: 1, gender: 1,
              ratings: 1, numReviews: 1, isTriable: 1,
              variantId: { $toString: '$_id' },
              price: 1, mrp: 1, discount: 1, images: 1, color: 1,
              merchant: { $arrayElemAt: ['$merchantDoc.shopName', 0] },
              merchantIsOnline: { $arrayElemAt: ['$merchantDoc.isOnline', 0] },
              merchantIsZoneLive: { $arrayElemAt: ['$merchantDoc.isZoneLive', 0] },
              brand: { $arrayElemAt: ['$brandDoc.name', 0] },
            }},
          ],
          countResult: [{ $count: 'totalCount' }],
        }},
      ];

      const [result] = await ProductFlat.aggregate(flatPipeline).allowDiskUse(true);
      const products = result?.products || [];
      const totalCount = result?.countResult?.[0]?.totalCount || 0;

      const enrichedProducts = products.map(p => {
        const isInstantBuyable = calculateIsInstantBuyable(p._id, p.merchantId, req.nearbyMerchantIds, {
          isOnline: p.merchantIsOnline, isZoneLive: p.merchantIsZoneLive
        });
        return { ...p, isInstantBuyable, isNearby: req.nearbyMerchantIds?.some(id => id.toString() === p.merchantId?.toString()) || false, isOnline: p.merchantIsOnline || false };
      });

      return res.json({ products: enrichedProducts, totalCount, page: pageNum, totalPages: Math.ceil(totalCount / limitNum) });
  } catch (err) {
    console.error('Error in getFilteredProducts:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


/**
 * ─── Search Suggestions (Autocomplete) ───
 * Returns up to 10 distinct suggestions from product names,
 * brand names, and category names matching the query.
 */
export const getSearchSuggestions = async (req, res) => {
  try {
    const { q = '' } = req.query;
    const query = q.trim();

    if (query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const regex = new RegExp(query, 'i');

    // Run parallel queries for speed
    const ProductModel = ProductFlat;
    const [productNames, brandNames, categoryNames, merchants] = await Promise.all([
      // Product name matches
      ProductModel.find({ name: regex, isActive: true, isDeleted: { $ne: true } })
        .select('name')
        .limit(6)
        .lean(),

      // Brand name matches
      mongoose.connection.db.collection('brands')
        .find({ name: regex })
        .project({ name: 1 })
        .limit(4)
        .toArray(),

      // Category name matches
      mongoose.connection.db.collection('categories')
        .find({ name: regex, isActive: { $ne: false } })
        .project({ name: 1 })
        .limit(4)
        .toArray(),
      
      // Merchant (Shop) matches
      Merchant.find({ shopName: regex, isActive: true, isVerified: true })
        .select('shopName address.city')
        .limit(4)
        .lean(),
    ]);

    const suggestions = [];
    const seen = new Set();

    // Deduplicate by lowercase text only to avoid double entries for the same name across types
    const addSuggestion = (text, type, id = null, city = null) => {
      const key = text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ text, type, id, city });
      }
    };

    // Prioritize merchants first so they "win" if a product/brand has the same name
    merchants.forEach(m => addSuggestion(m.shopName, 'merchant', m._id, m.address?.city));
    productNames.forEach(p => addSuggestion(p.name, 'product'));
    brandNames.forEach(b => addSuggestion(b.name, 'brand'));
    categoryNames.forEach(c => addSuggestion(c.name, 'category'));

    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (err) {
    console.error('Error in getSearchSuggestions:', err);
    res.status(500).json({ error: 'Server error' });
  }
};




export const getProductsByMerchantId = async (req, res) => {
  try {
    const { merchantId } = req.params;
    let merchant = null;
    if (mongoose.Types.ObjectId.isValid(merchantId)) {
      merchant = await Merchant.findOne({ _id: merchantId, isVerified: true, isActive: true });
    }

    let isWarehouse = false;
    let warehouse = null;

    if (!merchant) {
      const Warehouse = (await import('../../models/warehouse.model.js')).default;
      if (mongoose.Types.ObjectId.isValid(merchantId)) {
        warehouse = await Warehouse.findById(merchantId).lean();
      }
      if (warehouse || merchantId === 'ff-warehouse-hub' || merchantId === 'warehouse') {
        isWarehouse = true;
      } else {
        return res.status(404).json({ message: 'Non-verified or inactive shop' });
      }
    }

    const queryFilter = { isActive: true, isDeleted: { $ne: true } };
    if (isWarehouse) {
      if (warehouse) {
        queryFilter.$or = [{ warehouseId: warehouse._id }, { source: 'warehouse' }];
      } else {
        queryFilter.source = 'warehouse';
      }
    } else {
      queryFilter.merchantId = mongoose.Types.ObjectId.isValid(merchantId) ? new mongoose.Types.ObjectId(merchantId) : merchantId;
      queryFilter.source = { $ne: 'warehouse' };
    }

    console.log('[DEBUG getProductsByMerchantId] queryFilter:', JSON.stringify(queryFilter));

    const flatProducts = await ProductFlat.find(queryFilter)
      .populate([
        { path: 'brandId', select: 'name' },
        { path: 'categoryId', select: 'name' },
        { path: 'subCategoryId', select: 'name' },
      ])
      .lean();

    console.log('[DEBUG getProductsByMerchantId] flatProducts matched:', flatProducts.length);

    const cards = flatToCardData(flatProducts, req).map(card => ({
      ...card,
      isMainVariant: true,
      isWarehouseListing: isWarehouse,
      source: isWarehouse ? 'warehouse' : 'shop',
      isInstantBuyable: isWarehouse ? true : ((
        req.nearbyMerchantIds?.some(id => id.toString() === merchantId.toString()) &&
        merchant?.isOnline &&
        merchant?.isZoneLive
      ) || false),
    }));

    return res.json({ products: cards });
  } catch (err) {
    console.error('Error in getProductsByMerchantId:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getYouMayLikeProducts = async (req, res) => {
  try {
    const { subCategoryId, merchantId, excludeId, limit = 10 } = req.query;

    if (!subCategoryId || !mongoose.Types.ObjectId.isValid(subCategoryId)) {
      return res.status(400).json({ message: '❌ Invalid or missing subCategoryId' });
    }

    const subCatId = new mongoose.Types.ObjectId(subCategoryId);
    const merchId = mongoose.Types.ObjectId.isValid(merchantId) ? new mongoose.Types.ObjectId(merchantId) : null;
    const excludeObjId = mongoose.Types.ObjectId.isValid(excludeId) ? new mongoose.Types.ObjectId(excludeId) : null;

    const flatFilter = { subCategoryId: subCatId, isActive: true, isDeleted: { $ne: true } };
    if (excludeObjId) flatFilter.styleGroupId = { $ne: excludeObjId.toString() };
    if (req.nearbyMerchantIds) {
      if (merchId) flatFilter.merchantId = { $in: [...req.nearbyMerchantIds, merchId] };
      else flatFilter.merchantId = { $in: req.nearbyMerchantIds };
    }

    const flatProducts = await ProductFlat.find(flatFilter).limit(parseInt(limit) * 5).lean();
    const cards = flatToCardData(flatProducts, req).slice(0, parseInt(limit));
    return res.status(200).json(cards);
  } catch (error) {
    console.error('Error in getYouMayLikeProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

// New: Batch fetch products for multiple merchants
export const getProductsBatch = async (req, res) => {
  // Input validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { merchantIds } = req.body;

  // Validate ObjectIds
  const validIds = merchantIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length !== merchantIds.length) {
    return res.status(400).json({ message: 'One or more invalid merchant IDs' });
  }

  // Limit batch size
  if (merchantIds.length > 50) {
    return res.status(400).json({ message: 'Batch size exceeds limit (max 50)' });
  }

  try {
    const flatProducts = await ProductFlat.find({
      merchantId: { $in: merchantIds.map(id => new mongoose.Types.ObjectId(id)) },
      isActive: true, isDeleted: { $ne: true }
    })
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('brandId', 'name')
      .lean();

    // Group by merchantId, then by styleGroupId, limit 5 per merchant
    const byMerchant = {};
    flatProducts.forEach(p => {
      const mId = p.merchantId.toString();
      if (!byMerchant[mId]) byMerchant[mId] = {};
      const sgId = p.styleGroupId;
      if (!byMerchant[mId][sgId]) byMerchant[mId][sgId] = p;
    });

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
    const productsByMerchant = {};
    for (const [mId, groups] of Object.entries(byMerchant)) {
      const isInstantBuyable = nearbySet.has(mId);
      productsByMerchant[mId] = Object.values(groups).slice(0, 5).map(p => ({
        _id: p.styleGroupId,
        name: p.name,
        merchantId: p.merchantId,
        ratings: p.ratings || 0,
        gender: p.gender || [],
        price: p.price,
        mrp: p.mrp,
        discount: p.discount || 0,
        images: p.images,
        categoryId: p.categoryId?.name,
        subCategoryId: p.subCategoryId?.name,
        brandId: p.brandId?.name,
        isTriable: p.isTriable !== false,
        isInstantBuyable,
      }));
    }

    return res.status(200).json(productsByMerchant);
  } catch (error) {
    console.error('Error fetching batch products:', error);
    res.status(500).json({ message: 'Server error fetching batch products' });
  }
};


// ── Courier Products (from merchants with enableCourierDelivery) ──
export const getCourierProducts = async (req, res) => {
  try {
    const { gender, page = 1, limit = 20 } = req.query;
    const Merchant = (await import('../../models/merchant.model.js')).default;

    const combinedMerchants = await Merchant.find({
      $or: [
        { _id: { $in: req.nearbyMerchantIds || [] } },
        { enableCourierDelivery: true }
      ],
      isActive: true,
      isVerified: true,
    }).select('_id shopName logo backgroundImage rating stats isOnline genderCategory address').lean();

    const resolvedMerchants = await Promise.all(combinedMerchants.map(async (m) => {
      const ProductModel = ProductFlat;
      const countFilter = { merchantId: m._id, isActive: true, isDeleted: { $ne: true } };
      const count = await ProductModel.countDocuments(countFilter);
      return {
        ...m,
        stats: {
          ...m.stats,
          totalProducts: count
        }
      };
    }));

    let filteredCourierMerchants = resolvedMerchants;
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    // Removal of nearby exclusion — show ALL courier-enabled merchants
    if (!isNaN(lat) && !isNaN(lng) && req.nearbyMerchantIds) {
      console.log(`[getCourier] Coordinates provided: ${lat}, ${lng}. Proximity logic enabled.`);
    }

    if (filteredCourierMerchants.length === 0) {
      return res.status(200).json({ products: [], totalCount: 0, merchants: [] });
    }

    const merchantIds = filteredCourierMerchants.map(m => m._id);

    // 2. Build product filter
    const filter = {
      isActive: true,
      merchantId: { $in: merchantIds },
    };

    filter.isDeleted = { $ne: true };
    if (gender && gender !== 'All') filter.gender = gender;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const flatProducts = await ProductFlat.find(filter)
      .populate('merchantId', 'shopName isOnline')
      .sort({ createdAt: -1 })
      .lean();

    const cards = flatToCardData(flatProducts, req);
    const totalCount = cards.length;
    const paginatedCards = cards.slice(skip, skip + parseInt(limit));

    const enriched = paginatedCards.map(p => {
      const merchantIdStr = p.merchantId?.toString();
      const isNearby = req.nearbyMerchantIds?.some(id => id.toString() === merchantIdStr) || false;
      return { ...p, isNearby, isOnline: true };
    });

    return res.status(200).json({
      products: enriched,
      totalCount,
      merchants: filteredCourierMerchants,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error in getCourierProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

export const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    // Find source product from flat schema
    let sourceFlat = await ProductFlat.findOne({ styleGroupId: id }).select('subCategoryId categoryId merchantId').lean();
    if (!sourceFlat) sourceFlat = await ProductFlat.findById(id).select('subCategoryId categoryId merchantId styleGroupId').lean();
    if (!sourceFlat) {
      return res.status(404).json({ message: 'Source product not found' });
    }

    const flatFilter = {
      subCategoryId: sourceFlat.subCategoryId,
      isActive: true,
      isDeleted: { $ne: true },
      styleGroupId: { $ne: sourceFlat.styleGroupId || id },
    };

    const flatProducts = await ProductFlat.find(flatFilter).limit(parseInt(limit) * 5).lean();
    const cards = flatToCardData(flatProducts, req).slice(0, parseInt(limit));
    return res.status(200).json(cards);
  } catch (error) {
    console.error('Error in getRelatedProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

// ── Get Products by Collection ──
export const getCollectionProductsByMerchant = async (req, res) => {
  try {
    const { merchantId, collectionId } = req.query;

    if (!merchantId || !collectionId) {
      return res.status(400).json({ success: false, message: 'merchantId and collectionId are required' });
    }

    const flatProducts = await ProductFlat.find({
      merchantId,
      collectionIds: collectionId,
      isActive: true,
      isDeleted: { $ne: true },
    })
    .populate('brandId', 'name')
    .lean();

    const cards = flatToCardData(flatProducts, req).map(card => ({
      ...card,
      brandName: card.brandId?.name,
      isInstantBuyable: calculateIsInstantBuyable(card._id, merchantId, req.nearbyMerchantIds),
    }));

    return res.status(200).json({ success: true, products: cards });
  } catch (error) {
    console.error('[User] Get collection products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




