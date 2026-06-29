import Product from '../../models/product.model.js';
import Cart from '../../models/cart.model.js';
import Wishlist from '../../models/wishlist.model.js';
import Merchant from '../../models/merchant.model.js';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator'

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

    const filter = {
      isActive: true,
      createdAt: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 90))
      },
      variants: { $exists: true, $not: { $size: 0 } }
    };

    if (req.nearbyMerchantIds) {
      // Filter for merchants that are actually online
      const onlineMerchantIds = await Merchant.find({
        _id: { $in: req.nearbyMerchantIds },
        isOnline: true,
        isZoneLive: true
      }).select('_id').lean();
      
      filter.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
    }

    if (gender && gender !== 'All') {
      filter.gender = gender;
    }

    const products = await Product.find(filter)
      .select('name merchantId brandId ratings numReviews variants')
      .lean();

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);

    // Return only first variant card-level data
    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      return {
        _id: p._id,
        name: p.name,
        merchantId: p.merchantId,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
        isTriable: p.isTriable,
        isInstantBuyable: calculateIsInstantBuyable(p._id, p.merchantId, req.nearbyMerchantIds)
      };
    });

    res.status(200).json(trimmed);
  } catch (error) {
    console.error('Error in newArrivals:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

export const productsDetails = async (req, res) => {
  try {
    const product = await Product.findOne(
      { _id: req.params.id, isActive: true }
    )
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('subSubCategoryId', 'name')
      .populate({ 
        path: 'merchantId', 
        select: 'shopName logo isVerified isActive address isOnline isZoneLive', 
        match: { isVerified: true, isActive: true } 
      })
      .lean();

    if (!product || !product.merchantId) {
      return res.status(404).json({ message: 'Product from unverified or inactive shop' });
    }

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
    const isNearby = nearbySet.has(product.merchantId._id.toString());

    const isInstantBuyable = calculateIsInstantBuyable(product._id, product.merchantId._id, req.nearbyMerchantIds, {
      isOnline: product.merchantId.isOnline,
      isZoneLive: product.merchantId.isZoneLive
    });

    res.status(200).json({ ...product, isInstantBuyable, isNearby });
  } catch (error) {
    console.error('Error in productsDetails:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

// ── Trending Products ──
export const trendingProducts = async (req, res) => {
  try {
    const { gender } = req.query;

    const filter = {
      isActive: true,
      variants: { $exists: true, $not: { $size: 0 } }
    };

    if (req.nearbyMerchantIds) {
      const onlineMerchantIds = await Merchant.find({
        _id: { $in: req.nearbyMerchantIds },
        isOnline: true,
        isZoneLive: true
      }).select('_id').lean();
      
      filter.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
    }

    if (gender && gender !== 'All') {
      filter.gender = gender;
    }

    const products = await Product.find(filter)
      .select('name merchantId brandId ratings numReviews variants')
      .sort({ numReviews: -1, ratings: -1 }) // Sort by popularity
      .limit(15) // Limit to top 15 trending
      .lean();

    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      return {
        _id: p._id,
        name: p.name,
        merchantId: p.merchantId,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
        isTriable: p.isTriable,
        isInstantBuyable: calculateIsInstantBuyable(p._id, p.merchantId, req.nearbyMerchantIds)
      };
    });

    res.status(200).json(trimmed);
  } catch (error) {
    console.error('Error in trendingProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

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

      // 3. Find categories of those items
      if (excludedProductIds.length > 0) {
        const userProducts = await Product.find({ _id: { $in: excludedProductIds } })
          .select('subCategoryId subSubCategoryId')
          .lean();

        userProducts.forEach(p => {
          if (p.subCategoryId) subCategoryIds.push(p.subCategoryId.toString());
        });

        // Make unique
        subCategoryIds = [...new Set(subCategoryIds)];
      }
    }

    const filter = {
      isActive: true,
      variants: { $exists: true, $not: { $size: 0 } }
    };

    if (req.nearbyMerchantIds) {
      const onlineMerchantIds = await Merchant.find({
        _id: { $in: req.nearbyMerchantIds },
        isOnline: true,
        isZoneLive: true
      }).select('_id').lean();
      
      filter.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
    }

    if (gender && gender !== 'All') filter.gender = gender;

    if (excludedProductIds.length > 0) {
      filter._id = { $nin: excludedProductIds };
    }

    if (subCategoryIds.length > 0) {
      filter.subCategoryId = { $in: subCategoryIds };
    }

    let products = await Product.find(filter)
      .select('name merchantId brandId ratings numReviews variants')
      .limit(15)
      .lean();

    // Fallback if recommendations don't match anything (e.g. no cart history)
    if (products.length < 5) {
      delete filter.$or; // remove strict category filter
      products = await Product.find(filter)
        .select('name merchantId brandId ratings numReviews variants')
        .sort({ createdAt: -1 })
        .limit(15)
        .lean();
    }

    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      return {
        _id: p._id,
        name: p.name,
        merchantId: p.merchantId,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
        isTriable: p.isTriable,
        isInstantBuyable: calculateIsInstantBuyable(p._id, p.merchantId, req.nearbyMerchantIds)
      };
    });

    res.status(200).json(trimmed);
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

    /* ─── 1. Base match ─── */
    const match = {
      isActive: true,
      variants: { $exists: true, $not: { $size: 0 } },
    };

    if (deliveryMode === 'tryAndBuy') {
      // Only nearby merchants (within 7km) that are ONLINE
      if (req.nearbyMerchantIds && req.nearbyMerchantIds.length > 0) {
        const onlineMerchantIds = await Merchant.find({
          _id: { $in: req.nearbyMerchantIds },
          isOnline: true,
          isZoneLive: true
        }).select('_id').lean();
        
        if (onlineMerchantIds.length === 0) {
          return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
        }
        match.merchantId = { $in: onlineMerchantIds.map(m => m._id) };
      } else {
        return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
      }
    } else if (deliveryMode === 'courier') {
      // Courier-enabled merchants OUTSIDE the 7km radius
      const Merchant = (await import('../../models/merchant.model.js')).default;
      const courierMerchants = await Merchant.find({
        enableCourierDelivery: true,
        isActive: true,
        isVerified: true,
      }).select('_id').lean();

      const courierIds = courierMerchants.map(m => m._id);

      if (req.nearbyMerchantIds && req.nearbyMerchantIds.length > 0) {
        // Exclude nearby merchants — only those beyond 7km
        const nearbySet = new Set(req.nearbyMerchantIds.map(id => id.toString()));
        const courierOnlyIds = courierIds.filter(id => !nearbySet.has(id.toString()));
        if (courierOnlyIds.length === 0) {
          return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
        }
        match.merchantId = { $in: courierOnlyIds };
      } else {
        match.merchantId = { $in: courierIds };
      }
    } else {
      // No delivery filter — show all (nearby + courier)
      if (req.nearbyMerchantIds) {
        // Get courier merchant IDs too
        const Merchant = (await import('../../models/merchant.model.js')).default;
        const courierMerchants = await Merchant.find({
          enableCourierDelivery: true,
          isActive: true,
          isVerified: true,
        }).select('_id').lean();

        const nearbySet = new Set(req.nearbyMerchantIds.map(id => id.toString()));
        const courierOnlyIds = courierMerchants
          .map(m => m._id)
          .filter(id => !nearbySet.has(id.toString()));

        const allMerchantIds = [...req.nearbyMerchantIds, ...courierOnlyIds];
        match.merchantId = { $in: allMerchantIds };
      }
    }

    /* ─── 3. Gender filter ─── */
    if (gender) {
      if (gender === 'UNISEX') {
        // Products that have BOTH MEN and WOMEN in their gender array
        match.gender = { $all: ['MEN', 'WOMEN'] };
      } else {
        match.gender = gender; // MEN, WOMEN, or KIDS — matches array contains
      }
    }

    /* ─── 4. Store filter (intersect with delivery-resolved merchants) ─── */
    if (selectedStores?.length > 0) {
      const storeObjectIds = selectedStores
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      if (storeObjectIds.length > 0) {
        if (match.merchantId) {
          match.merchantId = {
            $in: match.merchantId.$in.filter(nearId =>
              storeObjectIds.some(selId => selId.equals(nearId))
            ),
          };
          if (match.merchantId.$in.length === 0) {
            return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
          }
        } else {
          match.merchantId = { $in: storeObjectIds };
        }
      } else {
        return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
      }
    }

    /* ─── 5. Category filter ─── */
    if (selectedCategoryIds.length > 0) {
      const validCatIds = selectedCategoryIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (validCatIds.length > 0) {
        match.$or = [
          { categoryId: { $in: validCatIds } },
          { subCategoryId: { $in: validCatIds } },
        ];
      }
    }

    /* ─── 6. Sub-category filter ─── */
    if (subCategoryIds.length > 0) {
      const validSubIds = subCategoryIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (validSubIds.length > 0) {
        match.subCategoryId = { $in: validSubIds };
      }
    }

    /* ─── 6.5 Collection filter ─── */
    if (collectionId && mongoose.Types.ObjectId.isValid(collectionId)) {
      match.collectionIds = new mongoose.Types.ObjectId(collectionId);
    }

    /* ─── 7. Aggregation pipeline ─── */
    const pipeline = [
      { $match: match },

      /* Lookups for search & display */
      {
        $lookup: {
          from: 'merchants', localField: 'merchantId', foreignField: '_id', as: 'merchant',
          pipeline: [{ $project: { shopName: 1, isOnline: 1, isZoneLive: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brand',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'categories', localField: 'subCategoryId', foreignField: '_id', as: 'subCategory',
          pipeline: [{ $project: { name: 1 } }],
        },
      },

      /* Unwind variants */
      { $unwind: '$variants' },

      /* Search filter (across looked-up fields) */
      ...(search.trim() !== ''
        ? [{
            $match: {
              $or: [
                { name: new RegExp(search.trim(), 'i') },
                { tags: new RegExp(search.trim(), 'i') },
                { 'variants.color.name': new RegExp(search.trim(), 'i') },
                { 'category.name': new RegExp(search.trim(), 'i') },
                { 'subCategory.name': new RegExp(search.trim(), 'i') },
                { 'brand.name': new RegExp(search.trim(), 'i') },
                { 'merchant.shopName': new RegExp(search.trim(), 'i') },
              ],
            },
          }]
        : []),

      /* Variant-level filters (price, color) */
      {
        $match: {
          ...(priceRange.length === 2 && {
            'variants.price': { $gte: priceRange[0], $lte: priceRange[1] },
          }),
          ...(selectedColors.length > 0 && {
            'variants.color.name': { $in: selectedColors },
          }),
        },
      },

      /* Project essential fields */
      {
        $project: {
          name: 1,
          merchantId: 1,
          brandId: 1,
          categoryId: 1,
          subCategoryId: 1,
          gender: 1,
          ratings: 1,
          numReviews: 1,
          isTriable: 1,
          variantId: '$variants._id',
          price: '$variants.price',
          mrp: '$variants.mrp',
          discount: '$variants.discount',
          stockSizes: '$variants.sizes',
          color: '$variants.color',
          images: '$variants.images',
          merchant: { $arrayElemAt: ['$merchant.shopName', 0] },
          merchantIsOnline: { $arrayElemAt: ['$merchant.isOnline', 0] },
          merchantIsZoneLive: { $arrayElemAt: ['$merchant.isZoneLive', 0] },
          brand: { $arrayElemAt: ['$brand.name', 0] },
          category: { $arrayElemAt: ['$category.name', 0] },
          subCategory: { $arrayElemAt: ['$subCategory.name', 0] },
        },
      },
    ];

    /* ─── 8. Sorting ─── */
    const sortOptions = {
      newest: { _id: -1 },
      oldest: { _id: 1 },
      priceLowToHigh: { price: 1 },
      priceHighToLow: { price: -1 },
      discount: { discount: -1 },
      rating: { ratings: -1 },
      trending: { numReviews: -1, ratings: -1 },
      relevance: { _id: -1 },
      price_low: { price: 1 },
      price_high: { price: -1 },
    };

    const sortKeys = Array.isArray(sortBy) ? sortBy : [sortBy];
    let finalSort = {};
    sortKeys.forEach(key => {
      if (sortOptions[key]) Object.assign(finalSort, sortOptions[key]);
    });
    if (Object.keys(finalSort).length === 0) finalSort = { _id: -1 };

    pipeline.push({ $sort: finalSort });

    /* ─── 9. $facet for pagination + count ─── */
    pipeline.push({
      $facet: {
        products: [{ $skip: skip }, { $limit: limitNum }],
        countResult: [{ $count: 'totalCount' }],
      },
    });

    /* ─── 10. Execute ─── */
    const [result] = await Product.aggregate(pipeline).allowDiskUse(true);
    const products = result?.products || [];
    const totalCount = result?.countResult?.[0]?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / limitNum);

    const enrichedProducts = products.map(p => {
      const isNearby = req.nearbyMerchantIds?.some(id => id.toString() === p.merchantId?.toString()) || false;
      const isInstantBuyable = calculateIsInstantBuyable(p._id, p.merchantId, req.nearbyMerchantIds, {
        isOnline: p.merchantIsOnline,
        isZoneLive: p.merchantIsZoneLive
      });
      return {
        ...p,
        isNearby,
        isOnline: p.merchantIsOnline || false,
        isInstantBuyable
      };
    });

    res.json({ products: enrichedProducts, totalCount, page: pageNum, totalPages });
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
    const [productNames, brandNames, categoryNames, merchants] = await Promise.all([
      // Product name matches
      Product.find({ name: regex, isActive: true })
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

    const Merchant = (await import('../../models/merchant.model.js')).default;
    const merchant = await Merchant.findOne({ _id: merchantId, isVerified: true, isActive: true });

    if (!merchant) {
      return res.status(404).json({ message: 'Non-verified or inactive shop' });
    }

    const products = await Product.find({ merchantId: merchantId, isActive: true })
      .select('name brandId categoryId subCategoryId gender variants ratings numReviews')
      .populate([
        { path: 'brandId', select: 'name' },
        { path: 'categoryId', select: 'name' },
        { path: 'subCategoryId', select: 'name' },
      ])
      .lean();

    const modifiedProducts = products.map(product => {
      const mainVariant = product.variants?.[0];
      if (!mainVariant) return null;

      return {
        _id: product._id,
        name: product.name,
        brand: product.brandId,
        merchant: product.merchantId,
        gender: product.gender,
        categoryId: product.categoryId,
        subCategoryId: product.subCategoryId,
        subSubCategoryId: product.subSubCategoryId,
        variantId: mainVariant._id,
        price: mainVariant.price,
        mrp: mainVariant.mrp,
        stockSizes: mainVariant.sizes,
        color: mainVariant.color,
        images: mainVariant.images,
        ratings: product.ratings,
        numReviews: product.numReviews,
        discount: mainVariant.discount || 0,
        isTriable: product.isTriable,
        isMainVariant: true,
        isInstantBuyable: req.nearbyMerchantIds?.some(id => id.toString() === merchantId.toString()) && 
                          merchant.isOnline && 
                          merchant.isZoneLive
      };
    }).filter(Boolean);

    res.json({ products: modifiedProducts });
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

    const matchConditions = {
      subCategoryId: subCatId,
      isActive: true,
    };

    if (excludeObjId) {
      matchConditions._id = { $ne: excludeObjId };
    }

    if (req.nearbyMerchantIds) {
      // Prioritize explicit merchantId if provided
      if (merchId) {
        matchConditions.merchantId = { $in: [...req.nearbyMerchantIds, merchId] };
      } else {
        matchConditions.merchantId = { $in: req.nearbyMerchantIds };
      }
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $addFields: {
          priority: {
            $cond: [
              { $eq: ['$merchantId', merchId] },
              0,
              1,
            ],
          },
        },
      },
      { $sort: { priority: 1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
          pipeline: [{ $project: { shopName: 1, isVerified: 1, isActive: 1 } }],
        },
      },
      { $unwind: { path: '$merchant' } },
      { $match: { 'merchant.isVerified': true, 'merchant.isActive': true } },
      // Project card-level fields only
      {
        $project: {
          name: 1,
          ratings: 1,
          numReviews: 1,
          gender: 1,
          isTriable: 1,
          merchantId: 1,
          brand: '$brand.name',
          merchant: '$merchant.shopName',
          isNearby: {
            $in: ['$merchantId', req.nearbyMerchantIds || []]
          },
          isInstantBuyable: {
            $and: [
              { $in: ['$merchantId', req.nearbyMerchantIds || []] },
              { $eq: ['$merchant.isOnline', true] },
              { $eq: ['$merchant.isZoneLive', true] }
            ]
          },
          // First variant only
          variantId: { $arrayElemAt: ['$variants._id', 0] },
          price: { $arrayElemAt: ['$variants.price', 0] },
          mrp: { $arrayElemAt: ['$variants.mrp', 0] },
          discount: { $arrayElemAt: ['$variants.discount', 0] },
          images: { $arrayElemAt: ['$variants.images', 0] },
          color: { $arrayElemAt: ['$variants.color', 0] },
        },
      },
    ];

    const products = await Product.aggregate(pipeline);

    res.status(200).json(products);
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
    // Fetch products using aggregation
    const products = await Product.aggregate([
      // Match active products for the merchant IDs
      {
        $match: {
          merchantId: { $in: merchantIds.map(id => new mongoose.Types.ObjectId(id)) },
          isActive: true
        }
      },
      // Group by merchantId to apply limit per merchant
      {
        $group: {
          _id: '$merchantId',
          products: { $push: '$$ROOT' }
        }
      },
      // Limit to 5 products per merchant
      {
        $project: {
          products: { $slice: ['$products', 5] }
        }
      },
      // Unwind to flatten products
      { $unwind: '$products' },
      // Project first variant's fields
      {
        $project: {
          _id: '$products._id',
          name: '$products.name',
          merchantId: '$products.merchantId',
          ratings: '$products.ratings',
          gender: { $ifNull: ['$products.gender', []] },
          categoryId: '$products.categoryId',
          subCategoryId: '$products.subCategoryId',

          brandId: '$products.brandId',
          price: { $arrayElemAt: ['$products.variants.price', 0] },
          mrp: { $arrayElemAt: ['$products.variants.mrp', 0] },
          discount: { $arrayElemAt: ['$products.variants.discount', 0] },
          images: { $arrayElemAt: ['$products.variants.images', 0] },
          isTriable: '$products.isTriable'
        }
      },
      // Populate category and brand names
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId'
        }
      },
      { $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategoryId'
        }
      },
      { $unwind: { path: '$subCategoryId', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brandId'
        }
      },
      { $unwind: { path: '$brandId', preserveNullAndEmptyArrays: true } },
      // Group by merchantId for final output
      {
        $group: {
          _id: '$merchantId',
          products: {
            $push: {
              _id: '$_id',
              name: '$name',
              merchantId: '$merchantId',
              ratings: '$ratings',
              gender: '$gender',
              price: '$price',
              mrp: '$mrp',
              discount: '$discount',
              images: '$images',
              categoryId: '$categoryId.name',
              subCategoryId: '$subCategoryId.name',
              brandId: '$brandId.name'
            }
          }
        }
      }
    ]);

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);

    // Format as { merchantId1: [products], ... }
    const productsByMerchant = products.reduce((acc, group) => {
      const isInstantBuyable = nearbySet.has(group._id.toString());
      acc[group._id.toString()] = group.products.map(p => ({ ...p, isInstantBuyable }));
      return acc;
    }, {});

    res.status(200).json(productsByMerchant);
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

    // 1. Find all eligible merchants (Nearby T&B OR Distant Courier)
    const combinedMerchants = await Merchant.find({
      $or: [
        { _id: { $in: req.nearbyMerchantIds || [] } },
        { enableCourierDelivery: true }
      ],
      isActive: true,
      isVerified: true,
    }).select('_id shopName logo').lean();

    let filteredCourierMerchants = combinedMerchants;
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
      variants: { $exists: true, $not: { $size: 0 } },
    };

    if (gender && gender !== 'All') {
      filter.gender = gender;
    }

    // 3. Fetch products with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, totalCount] = await Promise.all([
      Product.find(filter)
        .select('name merchantId brandId ratings numReviews variants')
        .populate('merchantId', 'shopName isOnline')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
    ]);

    // 4. Trim to card-level data
    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      const merchant = p.merchantId;
      const merchantIdStr = merchant?._id?.toString() || p.merchantId?.toString();
      const isNearby = req.nearbyMerchantIds?.some(id => id.toString() === merchantIdStr) || false;
      const isInstantBuyable = calculateIsInstantBuyable(p._id, merchantIdStr, req.nearbyMerchantIds, {
        isOnline: merchant?.isOnline
      });

      return {
        _id: p._id,
        name: p.name,
        merchantId: merchantIdStr,
        merchantName: merchant?.shopName || null,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
        isCourier: true,
        isNearby: isNearby,
        isInstantBuyable: isInstantBuyable,
        isOnline: merchant?.isOnline || false,
      };
    });

    res.status(200).json({
      products: trimmed,
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

    const sourceProduct = await Product.findById(id).select('subCategoryId categoryId merchantId').lean();
    if (!sourceProduct) {
      return res.status(404).json({ message: 'Source product not found' });
    }

    const subCatId = sourceProduct.subCategoryId;
    const merchId = sourceProduct.merchantId;

    const matchConditions = {
      subCategoryId: subCatId,
      isActive: true,
      _id: { $ne: new mongoose.Types.ObjectId(id) }
    };

    const pipeline = [
      { $match: matchConditions },
      {
        $addFields: {
          isSameStore: { $eq: ['$merchantId', merchId] }
        }
      },
      { $sort: { isSameStore: -1, ratings: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      { $unwind: '$merchant' },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand'
        }
      },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: 1,
          ratings: 1,
          numReviews: 1,
          gender: 1,
          merchantId: 1,
          brand: '$brand.name',
          shopName: '$merchant.shopName',
          isInstantBuyable: {
            $and: [
              { $in: ['$merchantId', req.nearbyMerchantIds || []] },
              { $eq: ['$merchant.isOnline', true] },
              { $eq: ['$merchant.isZoneLive', true] }
            ]
          },
          isCourierAvailable: { $ifNull: ['$merchant.enableCourierDelivery', false] },
          isNearby: {
            $in: ['$merchantId', req.nearbyMerchantIds || []]
          },
          variantId: { $arrayElemAt: ['$variants._id', 0] },
          price: { $arrayElemAt: ['$variants.price', 0] },
          mrp: { $arrayElemAt: ['$variants.mrp', 0] },
          discount: { $arrayElemAt: ['$variants.discount', 0] },
          images: { $arrayElemAt: ['$variants.images', 0] },
          color: { $arrayElemAt: ['$variants.color', 0] },
        }
      }
    ];

    const products = await Product.aggregate(pipeline);
    res.status(200).json(products);
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

    const products = await Product.find({
      merchantId,
      collectionIds: collectionId,
      isActive: true,
    })
    .select('name brandId ratings numReviews variants collectionIds')
    .populate('brandId', 'name')
    .lean();

    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      return {
        _id: p._id,
        name: p.name,
        brandName: p.brandId?.name,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
        isInstantBuyable: calculateIsInstantBuyable(p._id, p.merchantId, req.nearbyMerchantIds)
      };
    });

    res.status(200).json({ success: true, products: trimmed });
  } catch (error) {
    console.error('[User] Get collection products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




