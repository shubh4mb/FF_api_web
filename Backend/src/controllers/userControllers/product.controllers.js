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

  const nearbyWhSet = new Set(req.nearbyWarehouseIds?.map(id => id.toString()) || []);

  const cards = [];
  for (const siblings of Object.values(groups)) {
    const first = siblings[0]; // representative doc (first color/size)
    const merchantObj = (typeof first.merchantId === 'object' && first.merchantId !== null) ? first.merchantId : null;
    const merchantIdVal = merchantObj?._id || first.merchantId;

    const isWh = first.source === 'warehouse' || !!first.warehouseId || merchantObj?.fulfillmentType === 'warehouse';
    const isWhNearby = first.warehouseId ? nearbyWhSet.has(first.warehouseId.toString()) : (isWh && nearbyWhSet.size > 0);

    // Check available stock across all variants in this product group
    const totalStock = siblings.reduce((sum, s) => sum + Math.max(0, (s.stock || 0) - (s.reservedStock || 0)), 0);

    // In product listings, filter out products with 0 total stock
    if (totalStock <= 0) {
      continue;
    }

    const isStoreOnline = isWh ? true : (merchantObj?.isOnline !== undefined ? merchantObj.isOnline : true);
    const isInstantBuyable = isWh ? isWhNearby : calculateIsInstantBuyable(first.styleGroupId, merchantIdVal, req.nearbyMerchantIds, merchantObj || {});
    const isNearby = isWh ? isWhNearby : isInstantBuyable;

    cards.push({
      _id: first.styleGroupId,
      name: first.name,
      merchantId: merchantIdVal,
      warehouseId: first.warehouseId,
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
      isInstantBuyable,
      isNearby,
      isWarehouseListing: isWh,
      source: isWh ? 'warehouse' : 'shop',
      isOnline: isStoreOnline,
      stock: totalStock,
      totalStock,
      inStock: totalStock > 0,
    });
  }

  return cards;
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

/**
 * Helper to construct the location/nearby filter for Try & Buy products.
 * Includes both:
 * 1. Standard merchant products from nearby online merchants
 * 2. Warehouse products physically located in nearby warehouses
 */
const buildNearbyTAndBFilter = async (req) => {
  const hasNearbyMerchants = Array.isArray(req.nearbyMerchantIds);
  const hasNearbyWarehouses = Array.isArray(req.nearbyWarehouseIds);

  if (!hasNearbyMerchants && !hasNearbyWarehouses) {
    return null;
  }

  const onlineMerchantIds = (req.nearbyMerchantIds && req.nearbyMerchantIds.length > 0)
    ? (await Merchant.find({
      _id: { $in: req.nearbyMerchantIds },
      isOnline: true,
      isZoneLive: true
    }).select('_id').lean()).map(m => m._id)
    : [];

  const nearbyWarehouseIds = req.nearbyWarehouseIds || [];

  return {
    $or: [
      { merchantId: { $in: onlineMerchantIds }, source: { $ne: 'warehouse' } },
      { warehouseId: { $in: nearbyWarehouseIds } },
      { source: 'warehouse', warehouseId: { $in: nearbyWarehouseIds } }
    ]
  };
};

export const newArrivals = async (req, res) => {
  try {
    const { gender } = req.query;

    const flatFilter = {
      isActive: true,
      isDeleted: { $ne: true },
      isVerified: true,
      stock: { $gt: 0 },
      createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 90)) },
    };

    const nearbyCondition = await buildNearbyTAndBFilter(req);
    if (nearbyCondition) {
      flatFilter.$or = nearbyCondition.$or;
    }

    if (gender && gender !== 'All') {
      const genderUpper = gender.toUpperCase();
      flatFilter.gender = { $in: [genderUpper, 'UNISEX'] };
    }

    const flatProducts = await ProductFlat.find(flatFilter)
      .populate('merchantId', 'shopName isOnline isZoneLive')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(flatToCardData(flatProducts, req));
  } catch (error) {
    console.error('Error in newArrivals:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

export const productsDetails = async (req, res) => {
  try {
    const flatProductDoc = await ProductFlat.findOne({
      $or: [{ _id: req.params.id }, { styleGroupId: req.params.id }],
      isActive: true,
      isDeleted: { $ne: true },
      isVerified: true
    })
      .populate('brandId', 'name logo')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('subSubCategoryId', 'name')
      .populate('warehouseId', 'name code supportsTryAndBuy supportsCourier operatingHours')
      .populate({
        path: 'merchantId',
        select: 'shopName logo isVerified isActive address isOnline isZoneLive fulfillmentType isWarehouse warehouseName',
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

    const nearbyWhSet = new Set(req.nearbyWarehouseIds?.map(id => id.toString()) || []);
    const whIdStr = flatProductDoc.warehouseId?._id?.toString() || flatProductDoc.warehouseId?.toString();
    const isWhNearby = whIdStr ? nearbyWhSet.has(whIdStr) : false;

    const isWarehouse = flatProductDoc.source === 'warehouse';
    let isInstantBuyable = false;
    if (isWarehouse) {
      isInstantBuyable = isWhNearby;
    } else if (flatProductDoc.merchantId) {
      isInstantBuyable = calculateIsInstantBuyable(flatProductDoc.styleGroupId, flatProductDoc.merchantId._id || flatProductDoc.merchantId, req.nearbyMerchantIds, {
        isOnline: flatProductDoc.merchantId.isOnline,
        isZoneLive: flatProductDoc.merchantId.isZoneLive
      });
    }

    const allVariants = siblings.map(s => {
      const doc = s.toObject ? s.toObject() : s;
      return {
        ...doc,
        stock: Math.max(0, (doc.stock || 0) - (doc.reservedStock || 0)),
        colorVariantId: generateColorVariantId(flatProductDoc.styleGroupId, doc.color?.name || 'Default')
      };
    });

    let isWarehouseAvailable = isWarehouse;
    let whId = flatProductDoc.warehouseId?._id || flatProductDoc.warehouseId || null;
    let whName = flatProductDoc.warehouseId?.name || "FlashFits Hub";

    let isStoreTBServiceable = !isWarehouse;

    if (!isWarehouse) {
      const whTwin = await ProductFlat.findOne({
        $or: [
          { linkedMerchantProductId: flatProductDoc.styleGroupId },
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
    } else if (isWarehouse && flatProductDoc.linkedMerchantProductId) {
      const storeTwin = await ProductFlat.findOne({
        styleGroupId: flatProductDoc.linkedMerchantProductId,
        isActive: true,
        isDeleted: { $ne: true }
      }).lean();
      if (storeTwin && isNearby) {
        isStoreTBServiceable = true;
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

    const isStoreOnline = flatProductDoc.merchantId?.isOnline !== false;

    const fulfillmentOptions = {
      flashmart: {
        available: isWarehouseAvailable,
        estimatedTime: "45 Mins",
        label: "FlashMart Express",
        warehouseId: whId,
        warehouseName: whName,
      },
      directStore: {
        available: isStoreTBServiceable,
        isOnline: isStoreOnline,
        estimatedTime: isStoreOnline ? "45-60 Mins" : "Store Offline",
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

    const flatFilter = { isActive: true, isDeleted: { $ne: true }, isVerified: true, stock: { $gt: 0 } };
    const nearbyCondition = await buildNearbyTAndBFilter(req);
    if (nearbyCondition) {
      flatFilter.$or = nearbyCondition.$or;
    }
    if (gender && gender !== 'All') {
      const genderUpper = gender.toUpperCase();
      flatFilter.gender = { $in: [genderUpper, 'UNISEX'] };
    }

    const flatProducts = await ProductFlat.find(flatFilter)
      .populate('merchantId', 'shopName isOnline isZoneLive')
      .sort({ numReviews: -1, ratings: -1 })
      .lean();
    const cards = flatToCardData(flatProducts, req).slice(0, 15);
    return res.status(200).json(cards);
  } catch (error) {
    console.error('Error in trendingProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

// ── Recommended Products (Smart Wishlist & User Profile Driven) ──
export const recommendedProducts = async (req, res) => {
  try {
    const { gender, limit = 16, productIds, wishlistProductIds } = req.query;
    const userId = req.user?.userId;
    const maxResults = Math.min(Math.max(parseInt(limit) || 16, 4), 50);

    const anchorIds = new Set();
    const excludedStyleGroupIds = new Set();

    // 1. Explicit product / wishlist IDs passed from client (e.g. wishlist screen)
    const rawIds = productIds || wishlistProductIds;
    if (rawIds) {
      const idList = Array.isArray(rawIds) ? rawIds : String(rawIds).split(',');
      idList.forEach(id => {
        const clean = String(id).trim();
        if (clean) {
          anchorIds.add(clean);
          excludedStyleGroupIds.add(clean);
        }
      });
    }

    // 2. Fetch Wishlist & Cart from DB if authenticated
    if (userId) {
      const [wishlistDocs, cartDoc] = await Promise.all([
        Wishlist.find({ userId }).select('productId').lean(),
        Cart.findOne({ userId }).select('items.productId').lean()
      ]);

      if (wishlistDocs && wishlistDocs.length > 0) {
        wishlistDocs.forEach(w => {
          if (w.productId) {
            const str = w.productId.toString();
            anchorIds.add(str);
            excludedStyleGroupIds.add(str);
          }
        });
      }

      if (cartDoc && Array.isArray(cartDoc.items)) {
        cartDoc.items.forEach(item => {
          if (item.productId) {
            const str = item.productId.toString();
            anchorIds.add(str);
            excludedStyleGroupIds.add(str);
          }
        });
      }
    }

    const anchorIdList = Array.from(anchorIds);
    let uniqueAnchors = [];

    if (anchorIdList.length > 0) {
      // Find anchor product details
      const anchorDocs = await ProductFlat.find({
        styleGroupId: { $in: anchorIdList },
        isDeleted: { $ne: true }
      })
      .select('styleGroupId name categoryId subCategoryId subSubCategoryId gender matchingProducts brandId price ratings')
      .lean();

      const seen = new Set();
      for (const doc of anchorDocs) {
        if (!seen.has(doc.styleGroupId)) {
          seen.add(doc.styleGroupId);
          uniqueAnchors.push(doc);
        }
      }
    }

    // Base active filter
    const baseFilter = {
      isActive: true,
      isDeleted: { $ne: true },
      isVerified: true,
      stock: { $gt: 0 }
    };
    const nearbyCondition = await buildNearbyTAndBFilter(req);
    if (nearbyCondition) {
      baseFilter.$or = nearbyCondition.$or;
    }

    const excludedList = Array.from(excludedStyleGroupIds);
    const collectedCandidates = [];
    const collectedStyleGroupIds = new Set(excludedList);

    // If we have anchor products from wishlist / cart:
    if (uniqueAnchors.length > 0) {
      // Build distinct interest profiles (subcategory + gender pairs)
      // e.g., Men's Shirt -> { subCategoryId, genders: ['MEN', 'UNISEX'] }
      // Women's Dress -> { subCategoryId, genders: ['WOMEN', 'UNISEX'] }
      const profiles = [];
      const profileKeySet = new Set();

      for (const anchor of uniqueAnchors) {
        if (!anchor.subCategoryId) continue;
        const rawGenders = Array.isArray(anchor.gender) && anchor.gender.length > 0
          ? anchor.gender.map(g => g.toUpperCase())
          : ['MEN', 'WOMEN', 'UNISEX'];
        
        const genderKey = rawGenders.slice().sort().join(',');
        const key = `${anchor.subCategoryId.toString()}::${genderKey}`;

        if (!profileKeySet.has(key)) {
          profileKeySet.add(key);
          profiles.push({
            subCategoryId: anchor.subCategoryId,
            categoryId: anchor.categoryId,
            genders: Array.from(new Set([...rawGenders, 'UNISEX'])),
            matchingProducts: Array.isArray(anchor.matchingProducts) ? anchor.matchingProducts : [],
          });
        }
      }

      // ── TIER 1: Exact Subcategory + Matching Gender ──
      // "if there is a mens shirt, show another mens shirt"
      if (profiles.length > 0) {
        const tier1Queries = profiles.map(async (prof) => {
          return ProductFlat.find({
            ...baseFilter,
            styleGroupId: { $nin: excludedList },
            subCategoryId: prof.subCategoryId,
            gender: { $in: prof.genders }
          })
          .sort({ ratings: -1, numReviews: -1, createdAt: -1 })
          .limit(8)
          .lean();
        });

        const tier1Results = await Promise.all(tier1Queries);

        // Fair round-robin interleaving so recommendations balance across all wishlist items
        const maxLen = Math.max(...tier1Results.map(r => r.length), 0);
        for (let i = 0; i < maxLen; i++) {
          for (let pIdx = 0; pIdx < tier1Results.length; pIdx++) {
            const list = tier1Results[pIdx];
            if (i < list.length) {
              const item = list[i];
              if (!collectedStyleGroupIds.has(item.styleGroupId)) {
                collectedStyleGroupIds.add(item.styleGroupId);
                collectedCandidates.push(item);
              }
            }
          }
        }
      }

      // ── TIER 2: Curated Matching Products (Outfits & Pairings) ──
      if (collectedCandidates.length < maxResults) {
        const matchingIdsToFetch = [];
        for (const prof of profiles) {
          for (const mId of prof.matchingProducts) {
            if (mId && !collectedStyleGroupIds.has(mId)) {
              matchingIdsToFetch.push(mId);
            }
          }
        }

        if (matchingIdsToFetch.length > 0) {
          const matchingDocs = await ProductFlat.find({
            ...baseFilter,
            styleGroupId: { $in: matchingIdsToFetch, $nin: excludedList }
          }).limit(10).lean();

          for (const item of matchingDocs) {
            if (!collectedStyleGroupIds.has(item.styleGroupId)) {
              collectedStyleGroupIds.add(item.styleGroupId);
              collectedCandidates.push(item);
            }
          }
        }
      }

      // ── TIER 3: Broader Category + Gender Affinity ──
      // (e.g. other Men's apparel for a Men's shirt, or other Women's apparel for Women's dress)
      if (collectedCandidates.length < maxResults) {
        const categoryQueries = profiles
          .filter(p => p.categoryId)
          .map(p => ({
            categoryId: p.categoryId,
            gender: { $in: p.genders }
          }));

        if (categoryQueries.length > 0) {
          const broaderDocs = await ProductFlat.find({
            ...baseFilter,
            styleGroupId: { $nin: Array.from(collectedStyleGroupIds) },
            $or: categoryQueries
          })
          .sort({ ratings: -1, numReviews: -1, createdAt: -1 })
          .limit(maxResults * 2)
          .lean();

          for (const item of broaderDocs) {
            if (!collectedStyleGroupIds.has(item.styleGroupId)) {
              collectedStyleGroupIds.add(item.styleGroupId);
              collectedCandidates.push(item);
              if (collectedCandidates.length >= maxResults * 1.5) break;
            }
          }
        }
      }
    }

    // ── TIER 4: Discovery / Gender-Free Fallback ──
    // When wishlist is empty, or when recommendations pool is still low (< 6)
    if (collectedCandidates.length < 6) {
      const discoveryFilter = {
        isActive: true,
        isDeleted: { $ne: true },
        isVerified: true,
        stock: { $gt: 0 },
        styleGroupId: { $nin: Array.from(collectedStyleGroupIds) }
      };

      if (nearbyCondition) {
        discoveryFilter.$or = nearbyCondition.$or;
      }

      // If user has zero wishlist items AND caller explicitly passed a gender query, respect it as soft hint
      if (uniqueAnchors.length === 0 && gender && gender !== 'All') {
        discoveryFilter.gender = { $in: [gender.toUpperCase(), 'UNISEX'] };
      }
      // Otherwise: completely gender-neutral discovery! (No gender restriction)

      let discoveryDocs = await ProductFlat.find(discoveryFilter)
        .populate('merchantId', 'shopName isOnline isZoneLive')
        .sort({ ratings: -1, numReviews: -1, createdAt: -1 })
        .limit(maxResults * 2)
        .lean();

      // If strict nearbyCondition resulted in fewer than 4 items, relax nearbyCondition to courier
      if (discoveryDocs.length < 4 && nearbyCondition) {
        const relaxedFilter = {
          isActive: true,
          isDeleted: { $ne: true },
          isVerified: true,
          stock: { $gt: 0 },
          styleGroupId: { $nin: Array.from(collectedStyleGroupIds) }
        };
        if (uniqueAnchors.length === 0 && gender && gender !== 'All') {
          relaxedFilter.gender = { $in: [gender.toUpperCase(), 'UNISEX'] };
        }
        const relaxedDocs = await ProductFlat.find(relaxedFilter)
          .populate('merchantId', 'shopName isOnline isZoneLive')
          .sort({ ratings: -1, numReviews: -1 })
          .limit(maxResults * 2)
          .lean();
        discoveryDocs = [...discoveryDocs, ...relaxedDocs];
      }

      for (const item of discoveryDocs) {
        if (!collectedStyleGroupIds.has(item.styleGroupId)) {
          collectedStyleGroupIds.add(item.styleGroupId);
          collectedCandidates.push(item);
          if (collectedCandidates.length >= maxResults * 1.5) break;
        }
      }
    }

    // Transform into standard ProductCard objects
    const cards = flatToCardData(collectedCandidates, req).slice(0, maxResults);
    return res.status(200).json(cards);
  } catch (error) {
    console.error('Error in recommendedProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

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


    const andConditions = [
      { isActive: true, isDeleted: { $ne: true }, isVerified: true, stock: { $gt: 0 } }
    ];

    // Delivery mode / Location scoping
    if (deliveryMode === 'tryAndBuy') {
      const nearbyCondition = await buildNearbyTAndBFilter(req);
      if (nearbyCondition) {
        andConditions.push(nearbyCondition);
      }
    } else if (deliveryMode === 'courier') {
      const courierMerchants = await Merchant.find({ enableCourierDelivery: true, isActive: true, isVerified: true }).select('_id').lean();
      const courierIds = courierMerchants.map(m => m._id);
      if (req.nearbyMerchantIds && req.nearbyMerchantIds.length > 0) {
        const nearbySet = new Set(req.nearbyMerchantIds.map(id => id.toString()));
        const courierOnlyIds = courierIds.filter(id => !nearbySet.has(id.toString()));
        if (courierOnlyIds.length === 0) return res.json({ products: [], totalCount: 0, page: pageNum, totalPages: 0 });
        andConditions.push({ merchantId: { $in: courierOnlyIds } });
      } else {
        andConditions.push({ merchantId: { $in: courierIds } });
      }
    } else {
      if (req.nearbyMerchantIds || req.nearbyWarehouseIds) {
        const courierMerchants = await Merchant.find({ enableCourierDelivery: true, isActive: true, isVerified: true }).select('_id').lean();
        const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
        const courierOnlyIds = courierMerchants.map(m => m._id).filter(id => !nearbySet.has(id.toString()));
        const nearbyWarehouseIds = req.nearbyWarehouseIds || [];

        andConditions.push({
          $or: [
            { merchantId: { $in: [...(req.nearbyMerchantIds || []), ...courierOnlyIds] }, source: { $ne: 'warehouse' } },
            { warehouseId: { $in: nearbyWarehouseIds } },
            { source: 'warehouse', warehouseId: { $in: nearbyWarehouseIds } }
          ]
        });
      }
    }

    // Gender
    if (gender) {
      if (gender === 'UNISEX') andConditions.push({ gender: { $all: ['MEN', 'WOMEN'] } });
      else andConditions.push({ gender });
    }

    // Store filter
    if (selectedStores?.length > 0) {
      const storeObjectIds = selectedStores.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      if (storeObjectIds.length > 0) {
        andConditions.push({ merchantId: { $in: storeObjectIds } });
      }
    }

    // Category filter
    if (selectedCategoryIds.length > 0) {
      const validCatIds = selectedCategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      if (validCatIds.length > 0) {
        andConditions.push({
          $or: [{ categoryId: { $in: validCatIds } }, { subCategoryId: { $in: validCatIds } }]
        });
      }
    }
    if (subCategoryIds.length > 0) {
      const validSubIds = subCategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      if (validSubIds.length > 0) andConditions.push({ subCategoryId: { $in: validSubIds } });
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
        andConditions.push({ collectionIds: colObjId });
      }
    }

    // Search - isolate search condition and enrich with Category & Brand resolution
    let sanitizedSearch = '';
    const hasSearch = typeof search === 'string' && search.trim() !== '';
    if (hasSearch) {
      sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitizedSearch, 'i');

      // Resolve matching categories and brands in parallel
      const [matchedCategories, matchedBrands] = await Promise.all([
        mongoose.connection.db.collection('categories').find({ name: searchRegex }).project({ _id: 1 }).toArray(),
        mongoose.connection.db.collection('brands').find({ name: searchRegex }).project({ _id: 1 }).toArray(),
      ]);

      const matchedCatIds = matchedCategories.map(c => c._id);
      const matchedBrandIds = matchedBrands.map(b => b._id);

      const searchOrConditions = [
        { name: searchRegex },
        { tags: searchRegex },
        { 'color.name': searchRegex },
        { styleName: searchRegex }
      ];

      if (matchedCatIds.length > 0) {
        searchOrConditions.push({ categoryId: { $in: matchedCatIds } });
        searchOrConditions.push({ subCategoryId: { $in: matchedCatIds } });
      }
      if (matchedBrandIds.length > 0) {
        searchOrConditions.push({ brandId: { $in: matchedBrandIds } });
      }

      // Multi-word keyword matching (e.g. "baggy jeans")
      const words = search.trim().split(/\s+/).filter(w => w.length > 1);
      if (words.length > 1) {
        searchOrConditions.push({
          $and: words.map(w => {
            const wRegex = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            return {
              $or: [
                { name: wRegex },
                { tags: wRegex },
                { 'color.name': wRegex },
                { styleName: wRegex }
              ]
            };
          })
        });
      }

      andConditions.push({ $or: searchOrConditions });
    }

    // Price & color variant-level filters
    if (priceRange.length === 2) { andConditions.push({ price: { $gte: priceRange[0], $lte: priceRange[1] } }); }
    if (selectedColors.length > 0) { andConditions.push({ 'color.name': { $in: selectedColors } }); }

    const flatMatch = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

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

    const isRelevanceSort = (sortBy === 'relevance' || !sortBy) && hasSearch;

    const flatPipeline = [
      { $match: flatMatch },
      // Step: Deduplicate Warehouse and Merchant Store twins (canonicalId)
      {
        $addFields: {
          canonicalId: { $ifNull: ['$linkedMerchantProductId', '$styleGroupId'] },
          isWarehouseDoc: {
            $cond: [
              { $or: [{ $eq: ['$source', 'warehouse'] }, { $ne: [{ $ifNull: ['$warehouseId', null] }, null] }] },
              1,
              0
            ]
          }
        }
      },
      {
        $sort: {
          isWarehouseDoc: -1, // Prefer Warehouse listing first
          styleGroupId: 1,
          ...flatSort
        }
      },
      {
        $group: {
          _id: '$canonicalId',
          doc: { $first: '$$ROOT' },
        }
      },
      { $replaceRoot: { newRoot: '$doc' } },
      ...(isRelevanceSort ? [
        {
          $addFields: {
            __relevanceScore: {
              $cond: [
                { $regexMatch: { input: '$name', regex: sanitizedSearch, options: 'i' } },
                2,
                1
              ]
            }
          }
        },
        { $sort: { __relevanceScore: -1, ...flatSort } }
      ] : [
        { $sort: flatSort }
      ]),
      { $lookup: { from: 'merchants', localField: 'merchantId', foreignField: '_id', as: 'merchantDoc', pipeline: [{ $project: { shopName: 1, isOnline: 1, isZoneLive: 1 } }] } },
      { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brandDoc', pipeline: [{ $project: { name: 1 } }] } },
      {
        $facet: {
          products: [
            { $skip: skip }, { $limit: limitNum },
            {
              $project: {
                _id: '$styleGroupId',
                name: 1, merchantId: 1, brandId: 1, categoryId: 1, subCategoryId: 1, gender: 1,
                ratings: 1, numReviews: 1, isTriable: 1,
                variantId: { $toString: '$_id' },
                price: 1, mrp: 1, discount: 1, images: 1, color: 1,
                source: 1, warehouseId: 1,
                merchant: { $arrayElemAt: ['$merchantDoc.shopName', 0] },
                merchantIsOnline: { $arrayElemAt: ['$merchantDoc.isOnline', 0] },
                merchantIsZoneLive: { $arrayElemAt: ['$merchantDoc.isZoneLive', 0] },
                brand: { $arrayElemAt: ['$brandDoc.name', 0] },
              }
            },
          ],
          countResult: [{ $count: 'totalCount' }],
        }
      },
    ];

    const [result] = await ProductFlat.aggregate(flatPipeline).allowDiskUse(true);
    const products = result?.products || [];
    const totalCount = result?.countResult?.[0]?.totalCount || 0;

    const nearbyWhSet = new Set(req.nearbyWarehouseIds?.map(id => id.toString()) || []);
    const enrichedProducts = products.map(p => {
      const isWh = p.source === 'warehouse' || !!p.warehouseId;
      const isWhNearby = p.warehouseId ? nearbyWhSet.has(p.warehouseId.toString()) : false;
      const isInstantBuyable = isWh
        ? isWhNearby
        : calculateIsInstantBuyable(p._id, p.merchantId, req.nearbyMerchantIds, {
            isOnline: p.merchantIsOnline, isZoneLive: p.merchantIsZoneLive
          });
      const isNearby = isWh
        ? isWhNearby
        : (req.nearbyMerchantIds?.some(id => id.toString() === p.merchantId?.toString()) || false);
      const isOnline = deliveryMode === 'tryAndBuy'
        ? (p.merchantIsOnline !== undefined ? p.merchantIsOnline : true)
        : true;

      return {
        ...p,
        isWarehouseListing: isWh,
        isInstantBuyable,
        isNearby,
        isOnline
      };
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

    const queryFilter = {
      isActive: true,
      isDeleted: { $ne: true },
      isVerified: true,
      stock: { $gt: 0 }
    };
    if (isWarehouse) {
      if (warehouse) {
        queryFilter.$or = [{ warehouseId: warehouse._id }, { source: 'warehouse' }];
      } else {
        queryFilter.source = 'warehouse';
      }
    } else {
      queryFilter.merchantId = mongoose.Types.ObjectId.isValid(merchantId) ? new mongoose.Types.ObjectId(merchantId) : merchantId;
    }

    console.log('[DEBUG getProductsByMerchantId] queryFilter:', JSON.stringify(queryFilter));

    const flatProducts = await ProductFlat.find(queryFilter)
      .populate([
        { path: 'brandId', select: 'name' },
        { path: 'categoryId', select: 'name' },
        { path: 'subCategoryId', select: 'name' },
        { path: 'merchantId', select: 'shopName isOnline isZoneLive' }
      ])
      .lean();

    console.log('[DEBUG getProductsByMerchantId] flatProducts matched:', flatProducts.length);

    const isWarehouseBrand = merchant?.fulfillmentType === 'warehouse' || isWarehouse;
    const cards = flatToCardData(flatProducts, req).map(card => ({
      ...card,
      isMainVariant: true,
      isWarehouseListing: isWarehouseBrand || isWarehouse || card.source === 'warehouse',
      source: (isWarehouseBrand || isWarehouse || card.source === 'warehouse') ? 'warehouse' : 'shop',
      isOnline: isWarehouseBrand || isWarehouse ? true : (merchant?.isOnline !== false),
      isInstantBuyable: (isWarehouseBrand || isWarehouse || card.source === 'warehouse') ? true : ((
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
    const { subCategoryId, merchantId, excludeId, limit = 10, gender } = req.query;

    if (!subCategoryId || !mongoose.Types.ObjectId.isValid(subCategoryId)) {
      return res.status(400).json({ message: '❌ Invalid or missing subCategoryId' });
    }

    const subCatId = new mongoose.Types.ObjectId(subCategoryId);
    const merchId = mongoose.Types.ObjectId.isValid(merchantId) ? new mongoose.Types.ObjectId(merchantId) : null;
    const excludeObjId = mongoose.Types.ObjectId.isValid(excludeId) ? new mongoose.Types.ObjectId(excludeId) : null;

    const flatFilter = { subCategoryId: subCatId, isActive: true, isDeleted: { $ne: true }, isVerified: true, stock: { $gt: 0 } };
    if (excludeObjId) flatFilter.styleGroupId = { $ne: excludeObjId.toString() };
    if (req.nearbyMerchantIds) {
      if (merchId) flatFilter.merchantId = { $in: [...req.nearbyMerchantIds, merchId] };
      else flatFilter.merchantId = { $in: req.nearbyMerchantIds };
    }

    if (gender && gender !== 'All') {
      const gList = (Array.isArray(gender) ? gender : [gender]).map(g => String(g).toUpperCase());
      flatFilter.gender = { $in: Array.from(new Set([...gList, 'UNISEX'])) };
    }

    const flatProducts = await ProductFlat.find(flatFilter)
      .populate('merchantId', 'shopName isOnline isZoneLive')
      .limit(parseInt(limit) * 5)
      .lean();
    let cards = flatToCardData(flatProducts, req);
    if (gender && gender !== 'All') {
      const gList = (Array.isArray(gender) ? gender : [gender]).map(g => String(g).toUpperCase());
      cards = cards.filter(card => {
        if (!card.gender || (Array.isArray(card.gender) && card.gender.length === 0)) return true;
        const cGenders = (Array.isArray(card.gender) ? card.gender : [card.gender]).map(g => String(g).toUpperCase());
        return cGenders.some(g => gList.includes(g) || g === 'UNISEX');
      });
    }
    return res.status(200).json(cards.slice(0, parseInt(limit)));
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
      isActive: true,
      isDeleted: { $ne: true },
      isVerified: true
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
      fulfillmentType: { $ne: 'warehouse' },
    }).select('_id shopName logo backgroundImage rating stats isOnline genderCategory address fulfillmentType').lean();

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

    // ── Include FlashFits Warehouse Hub as a Virtual Store Card ──
    const warehouseStores = [];
    try {
      const Warehouse = (await import('../../models/warehouse.model.js')).default;
      const activeWarehouses = await Warehouse.find({ isActive: true }).lean();
      const totalWarehouseProducts = await ProductFlat.countDocuments({
        $or: [{ source: 'warehouse' }, { warehouseId: { $exists: true, $ne: null } }],
        isActive: true,
        isDeleted: { $ne: true }
      });

      if (activeWarehouses.length > 0) {
        for (const wh of activeWarehouses) {
          const whCount = await ProductFlat.countDocuments({
            $or: [{ warehouseId: wh._id }, { source: 'warehouse' }],
            isActive: true,
            isDeleted: { $ne: true }
          });
          warehouseStores.push({
            _id: wh._id.toString(),
            shopName: wh.name || 'FlashFits Warehouse Hub',
            logo: { url: '' },
            backgroundImage: { url: '' },
            genderCategory: ['MEN', 'WOMEN', 'KIDS', 'Unisex'],
            shipsWithinHours: 1,
            isOnline: true,
            isZoneLive: true,
            isNearby: true,
            isWarehouse: true,
            rating: 4.9,
            address: wh.address || { city: 'FlashFits Hub' },
            stats: { totalProducts: whCount > 0 ? whCount : totalWarehouseProducts }
          });
        }
      } else if (totalWarehouseProducts > 0) {
        warehouseStores.push({
          _id: 'ff-warehouse-hub',
          shopName: 'FlashFits Warehouse Hub',
          logo: { url: '' },
          backgroundImage: { url: '' },
          genderCategory: ['MEN', 'WOMEN', 'KIDS', 'Unisex'],
          shipsWithinHours: 1,
          isOnline: true,
          isZoneLive: true,
          isNearby: true,
          isWarehouse: true,
          rating: 4.9,
          address: { city: 'FlashFits Hub' },
          stats: { totalProducts: totalWarehouseProducts }
        });
      }
    } catch (whErr) {
      console.error('Error attaching warehouse store to courier explore:', whErr.message);
    }

    let filteredCourierMerchants = [...warehouseStores, ...resolvedMerchants];
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    // Removal of nearby exclusion — show ALL courier-enabled merchants
    if (!isNaN(lat) && !isNaN(lng) && req.nearbyMerchantIds) {
      console.log(`[getCourier] Coordinates provided: ${lat}, ${lng}. Proximity logic enabled.`);
    }

    if (filteredCourierMerchants.length === 0) {
      return res.status(200).json({ products: [], totalCount: 0, merchants: [] });
    }

    const physicalMerchantIds = resolvedMerchants.map(m => m._id);

    // 2. Build product filter (includes courier physical store products + warehouse products)
    const filter = {
      isActive: true,
      $or: [
        { merchantId: { $in: physicalMerchantIds } },
        { source: 'warehouse' },
        { warehouseId: { $exists: true, $ne: null } }
      ]
    };

    filter.isDeleted = { $ne: true };
    if (gender && gender !== 'All') filter.gender = gender;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const flatProducts = await ProductFlat.find(filter)
      .populate('merchantId', 'shopName isOnline isZoneLive fulfillmentType')
      .sort({ createdAt: -1 })
      .lean();

    const cards = flatToCardData(flatProducts, req);
    const totalCount = cards.length;
    const paginatedCards = cards.slice(skip, skip + parseInt(limit));

    const nearbyWhSet = new Set(req.nearbyWarehouseIds?.map(id => id.toString()) || []);
    const nearbyMerchantSet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);

    const enriched = paginatedCards.map(p => {
      const isWh = p.isWarehouseListing || p.source === 'warehouse' || !!p.warehouseId;
      const isWhNearby = p.warehouseId ? nearbyWhSet.has(p.warehouseId.toString()) : (isWh && nearbyWhSet.size > 0);
      const isMerchantNearby = p.merchantId ? nearbyMerchantSet.has(p.merchantId.toString()) : false;
      const isNearby = isWh ? isWhNearby : (p.isNearby !== undefined ? p.isNearby : isMerchantNearby);
      const isInstantBuyable = isWh ? isWhNearby : (p.isInstantBuyable !== undefined ? p.isInstantBuyable : isMerchantNearby);
      return {
        ...p,
        isNearby,
        isInstantBuyable,
        isWarehouseListing: isWh,
        source: isWh ? 'warehouse' : (p.source || 'shop'),
        isOnline: true
      };
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
    const { limit = 10, gender } = req.query;

    // Find source product from flat schema
    let sourceFlat = await ProductFlat.findOne({ styleGroupId: id }).select('subCategoryId categoryId merchantId gender styleGroupId').lean();
    if (!sourceFlat) sourceFlat = await ProductFlat.findById(id).select('subCategoryId categoryId merchantId gender styleGroupId').lean();
    if (!sourceFlat) {
      return res.status(404).json({ message: 'Source product not found' });
    }

    // Determine target genders (from query param or source product)
    let rawGenders = [];
    if (gender && gender !== 'All') {
      rawGenders = (Array.isArray(gender) ? gender : [gender]).map(g => String(g).toUpperCase());
    } else if (Array.isArray(sourceFlat.gender) && sourceFlat.gender.length > 0) {
      rawGenders = sourceFlat.gender.map(g => String(g).toUpperCase());
    } else if (typeof sourceFlat.gender === 'string' && sourceFlat.gender) {
      rawGenders = [sourceFlat.gender.toUpperCase()];
    }

    const allowedGenders = rawGenders.length > 0 ? Array.from(new Set([...rawGenders, 'UNISEX'])) : [];

    const flatFilter = {
      subCategoryId: sourceFlat.subCategoryId,
      isActive: true,
      isDeleted: { $ne: true },
      isVerified: true,
      styleGroupId: { $ne: sourceFlat.styleGroupId || id },
    };

    if (allowedGenders.length > 0) {
      flatFilter.gender = { $in: allowedGenders };
    }

    const maxLimit = parseInt(limit) || 10;
    let flatProducts = await ProductFlat.find(flatFilter)
      .populate('merchantId', 'shopName isOnline isZoneLive fulfillmentType')
      .limit(maxLimit * 5)
      .lean();

    // If not enough products from same subcategory, backfill with same category and same gender
    if (flatProducts.length < maxLimit * 2 && sourceFlat.categoryId) {
      const existingStyleGroupIds = new Set(flatProducts.map(p => p.styleGroupId));
      existingStyleGroupIds.add(sourceFlat.styleGroupId || id);

      const backfillFilter = {
        categoryId: sourceFlat.categoryId,
        styleGroupId: { $nin: Array.from(existingStyleGroupIds) },
        isActive: true,
        isDeleted: { $ne: true },
        isVerified: true,
      };
      if (allowedGenders.length > 0) {
        backfillFilter.gender = { $in: allowedGenders };
      }

      const backfill = await ProductFlat.find(backfillFilter)
        .populate('merchantId', 'shopName isOnline isZoneLive fulfillmentType')
        .limit(maxLimit * 5)
        .lean();
      flatProducts = flatProducts.concat(backfill);
    }

    let cards = flatToCardData(flatProducts, req);
    if (rawGenders.length > 0) {
      cards = cards.filter(card => {
        if (!card.gender || (Array.isArray(card.gender) && card.gender.length === 0)) return true;
        const cGenders = (Array.isArray(card.gender) ? card.gender : [card.gender]).map(g => String(g).toUpperCase());
        return cGenders.some(g => rawGenders.includes(g) || g === 'UNISEX');
      });
    }

    return res.status(200).json(cards.slice(0, maxLimit));
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
      isVerified: true,
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




