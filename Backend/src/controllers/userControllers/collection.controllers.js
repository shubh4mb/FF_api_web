import mongoose from 'mongoose';
import Collection from '../../models/collection.model.js';
import ProductFlat from '../../models/productFlat.model.js';
import Merchant from '../../models/merchant.model.js';
import Offer from '../../models/offer.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Helper to build the MongoDB product query matching a collection's criteria
 */
const buildCollectionProductQuery = (coll, onlineNearbyIds, { gender, subCurationId, search, priceMin, priceMax } = {}) => {
  const orClauses = [
    { collectionIds: coll._id }
  ];

  // Smart Rules
  const rules = coll.smartRules || {};
  const ruleConditions = [];

  if (rules.categoryIds?.length > 0) {
    ruleConditions.push({ categoryId: { $in: rules.categoryIds } });
  }
  if (rules.subCategoryIds?.length > 0) {
    ruleConditions.push({ subCategoryId: { $in: rules.subCategoryIds } });
  }
  if (rules.tags?.length > 0) {
    ruleConditions.push({ tags: { $in: rules.tags.map(t => new RegExp(`^${t}$`, 'i')) } });
  }
  if (rules.keywords?.length > 0) {
    const keywordRegex = rules.keywords.map(k => new RegExp(k, 'i'));
    ruleConditions.push({ name: { $in: keywordRegex } });
  }
  if (rules.colorKeywords?.length > 0) {
    const colorRegex = rules.colorKeywords.map(c => new RegExp(c, 'i'));
    ruleConditions.push({ 'color.name': { $in: colorRegex } });
  }

  if (ruleConditions.length > 0) {
    let combinedRule = { $or: ruleConditions };
    if (rules.genders?.length > 0) {
      combinedRule.gender = { $in: rules.genders };
    }
    if (rules.maxPrice) {
      combinedRule.price = { $lte: Number(rules.maxPrice) };
    }
    orClauses.push(combinedRule);
  }

  const query = {
    isActive: true,
    isVerified: true,
    isDeleted: { $ne: true },
    $or: orClauses,
  };

  if (onlineNearbyIds && onlineNearbyIds.length > 0) {
    query.merchantId = { $in: onlineNearbyIds };
  }

  if (coll.excludedProductIds?.length > 0) {
    query._id = { $nin: coll.excludedProductIds };
  }

  // Sub-Curation specific filter
  if (subCurationId && subCurationId !== 'all' && coll.subCurations?.length > 0) {
    const sub = coll.subCurations.find(s => s.id === subCurationId);
    if (sub) {
      if (sub.categoryId) query.categoryId = sub.categoryId;
      if (sub.filterTag) query.tags = { $regex: new RegExp(sub.filterTag, 'i') };
      if (sub.gender && sub.gender !== 'ALL') query.gender = sub.gender;
      if (sub.maxPrice) query.price = { ...(query.price || {}), $lte: sub.maxPrice };
    }
  }

  // General query overrides
  if (gender && gender !== 'All' && gender !== 'ALL') {
    query.gender = gender;
  }

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  if (priceMin || priceMax) {
    query.price = query.price || {};
    if (priceMin) query.price.$gte = Number(priceMin);
    if (priceMax) query.price.$lte = Number(priceMax);
  }

  return query;
};

/**
 * ── Get Collections For Home Page ──
 * Fetches active collections and their products, 
 * filtered by schedule, proximity (req.nearbyMerchantIds) and merchant online status.
 */
export const getCollectionsForHome = asyncHandler(async (req, res) => {
  const { gender } = req.query;
  const nearbyIds = req.nearbyMerchantIds;
  const now = new Date();

  // 1. Fetch active collections with schedule validity
  const collections = await Collection.find({
    isActive: true,
    $or: [
      { 'schedule.isScheduled': { $ne: true } },
      {
        'schedule.isScheduled': true,
        $and: [
          { $or: [{ 'schedule.startDate': null }, { 'schedule.startDate': { $lte: now } }] },
          { $or: [{ 'schedule.endDate': null }, { 'schedule.endDate': { $gte: now } }] }
        ]
      }
    ]
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  if (!collections || collections.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], "No collections found"));
  }

  // 2. Resolve Online Merchants within range
  let onlineNearbyIds = [];
  if (nearbyIds && nearbyIds.length > 0) {
    const onlineMerchants = await Merchant.find({
      _id: { $in: nearbyIds },
      isOnline: true,
      isActive: true,
      isVerified: true
    }).select('_id').lean();
    onlineNearbyIds = onlineMerchants.map(m => m._id);
  } else {
    return res.status(200).json(new ApiResponse(200, [], "No available merchants nearby"));
  }

  // 3. For each collection, find eligible products
  const result = await Promise.all(collections.map(async (coll) => {
    const flatFilter = buildCollectionProductQuery(coll, onlineNearbyIds, { gender });

    const flatProducts = await ProductFlat.find(flatFilter)
      .populate('merchantId', 'isOnline isZoneLive storeName')
      .limit(60)
      .lean();

    const pinnedSet = new Set((coll.pinnedProductIds || []).map(p => p.toString()));

    // Group by styleGroupId and prioritize pinned
    const groups = {};
    flatProducts.forEach(p => {
      if (!groups[p.styleGroupId]) groups[p.styleGroupId] = p;
    });

    const uniqueProducts = Object.values(groups);
    uniqueProducts.sort((a, b) => {
      const aPinned = pinnedSet.has(a._id.toString()) || pinnedSet.has(a.styleGroupId) ? 1 : 0;
      const bPinned = pinnedSet.has(b._id.toString()) || pinnedSet.has(b.styleGroupId) ? 1 : 0;
      return bPinned - aPinned;
    });

    const products = uniqueProducts.slice(0, 10);

    // Trim variants for mobile card view
    const trimmedProducts = products.map(p => {
      const merchant = p.merchantId;
      const merchantIdStr = merchant?._id?.toString() || p.merchantId?.toString();

      const isNearby = req.nearbyMerchantIds?.some(id => id.toString() === merchantIdStr) || false;
      const isOnline = merchant?.isOnline !== false;
      const isZoneLive = merchant?.isZoneLive !== false;

      return {
        _id: p.styleGroupId,
        name: p.name,
        merchantId: merchantIdStr,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: p._id,
        price: p.price,
        mrp: p.mrp,
        discount: p.discount || 0,
        images: p.images,
        color: p.color,
        isNearby,
        isOnline,
        isInstantBuyable: isNearby && isOnline && isZoneLive,
      };
    });

    return {
      _id: coll._id,
      name: coll.name,
      slug: coll.slug,
      tagline: coll.tagline,
      description: coll.description,
      campaignType: coll.campaignType || 'curated',
      badgeText: coll.badgeText || '',
      banner: coll.bannerImage?.url ? { imageUrl: coll.bannerImage.url } : null,
      heroBanner: coll.heroBannerImage?.url ? { imageUrl: coll.heroBannerImage.url } : null,
      theme: coll.theme || {},
      schedule: coll.schedule || {},
      attachedCouponCode: coll.attachedCouponCode || '',
      subCurations: coll.subCurations || [],
      products: trimmedProducts
    };
  }));

  // Filter out collections that have 0 products available for this user's location
  const filteredResult = result.filter(r => r.products.length > 0);

  return res.status(200).json(new ApiResponse(200, filteredResult, "Collections fetched successfully"));
});

/**
 * ── Get Dedicated Collection / Campaign Details ──
 * Endpoint: GET /user/collections/:slugOrId
 * Returns full campaign details, sub-curations, attached coupon, and paginated products.
 */
export const getCollectionDetails = asyncHandler(async (req, res) => {
  const { slugOrId } = req.params;
  const { subCurationId, gender, sortBy = 'relevance', priceMin, priceMax, search, page = 1, limit = 20 } = req.query;
  const nearbyIds = req.nearbyMerchantIds || [];

  const isObjectId = mongoose.Types.ObjectId.isValid(slugOrId);
  const collection = await Collection.findOne(
    isObjectId ? { $or: [{ _id: slugOrId }, { slug: slugOrId }] } : { slug: slugOrId }
  )
    .populate('smartRules.categoryIds', 'name')
    .populate('subCurations.categoryId', 'name')
    .lean();

  if (!collection || (!collection.isActive)) {
    throw new ApiError(404, "Campaign or collection not found");
  }

  // 1. Resolve Attached Coupon Details (if any)
  let attachedOffer = null;
  if (collection.attachedCouponCode) {
    const offerDoc = await Offer.findOne({
      couponCode: collection.attachedCouponCode.toUpperCase(),
      isActive: true
    }).select('title description couponCode discountType discountValue maxDiscount minOrderValue startDate endDate').lean();

    if (offerDoc) {
      attachedOffer = offerDoc;
    }
  }

  // 2. Resolve Online Merchants within range
  let onlineNearbyIds = [];
  if (nearbyIds.length > 0) {
    const onlineMerchants = await Merchant.find({
      _id: { $in: nearbyIds },
      isOnline: true,
      isActive: true,
      isVerified: true
    }).select('_id').lean();
    onlineNearbyIds = onlineMerchants.map(m => m._id);
  }

  if (onlineNearbyIds.length === 0) {
    return res.status(200).json(new ApiResponse(200, {
      collection: {
        _id: collection._id,
        name: collection.name,
        slug: collection.slug,
        tagline: collection.tagline,
        description: collection.description,
        campaignType: collection.campaignType,
        badgeText: collection.badgeText,
        banner: collection.bannerImage?.url ? { imageUrl: collection.bannerImage.url } : null,
        heroBanner: collection.heroBannerImage?.url ? { imageUrl: collection.heroBannerImage.url } : null,
        theme: collection.theme,
        schedule: collection.schedule,
        subCurations: collection.subCurations || [],
        attachedOffer,
      },
      products: [],
      totalCount: 0,
      page: Number(page),
      totalPages: 0
    }, "No online merchants nearby"));
  }

  // 3. Build product query
  const query = buildCollectionProductQuery(collection, onlineNearbyIds, {
    gender,
    subCurationId,
    search,
    priceMin,
    priceMax
  });

  // Sort strategy
  let sortOption = { createdAt: -1 };
  if (sortBy === 'price_low') sortOption = { price: 1 };
  else if (sortBy === 'price_high') sortOption = { price: -1 };
  else if (sortBy === 'newest') sortOption = { createdAt: -1 };
  else if (sortBy === 'trending') sortOption = { ratings: -1, numReviews: -1 };

  const rawProducts = await ProductFlat.find(query)
    .populate('merchantId', 'isOnline isZoneLive storeName')
    .populate('categoryId', 'name')
    .sort(sortOption)
    .lean();

  const pinnedSet = new Set((collection.pinnedProductIds || []).map(p => p.toString()));

  // Group by styleGroupId and prioritize pinned
  const groups = {};
  rawProducts.forEach(p => {
    if (!groups[p.styleGroupId]) groups[p.styleGroupId] = p;
  });

  let uniqueProducts = Object.values(groups);

  if (sortBy === 'relevance') {
    uniqueProducts.sort((a, b) => {
      const aPinned = pinnedSet.has(a._id.toString()) || pinnedSet.has(a.styleGroupId) ? 1 : 0;
      const bPinned = pinnedSet.has(b._id.toString()) || pinnedSet.has(b.styleGroupId) ? 1 : 0;
      return bPinned - aPinned;
    });
  }

  const totalCount = uniqueProducts.length;
  const numLimit = Number(limit);
  const numPage = Number(page);
  const skip = (numPage - 1) * numLimit;
  const paginatedList = uniqueProducts.slice(skip, skip + numLimit);

  const formattedProducts = paginatedList.map(p => {
    const merchant = p.merchantId;
    const merchantIdStr = merchant?._id?.toString() || p.merchantId?.toString();
    const isNearby = nearbyIds.some(id => id.toString() === merchantIdStr);
    const isOnline = merchant?.isOnline !== false;
    const isZoneLive = merchant?.isZoneLive !== false;

    return {
      _id: p.styleGroupId,
      name: p.name,
      merchantId: merchantIdStr,
      merchantName: merchant?.storeName || '',
      brandId: p.brandId,
      ratings: p.ratings,
      numReviews: p.numReviews,
      variantId: p._id,
      price: p.price,
      mrp: p.mrp,
      discount: p.discount || 0,
      images: p.images,
      color: p.color,
      categoryName: p.categoryId?.name || '',
      isNearby,
      isOnline,
      isInstantBuyable: isNearby && isOnline && isZoneLive,
    };
  });

  return res.status(200).json(new ApiResponse(200, {
    collection: {
      _id: collection._id,
      name: collection.name,
      slug: collection.slug,
      tagline: collection.tagline,
      description: collection.description,
      campaignType: collection.campaignType,
      badgeText: collection.badgeText,
      banner: collection.bannerImage?.url ? { imageUrl: collection.bannerImage.url } : null,
      heroBanner: collection.heroBannerImage?.url ? { imageUrl: collection.heroBannerImage.url } : null,
      theme: collection.theme,
      schedule: collection.schedule,
      subCurations: collection.subCurations || [],
      attachedOffer,
    },
    products: formattedProducts,
    totalCount,
    page: numPage,
    totalPages: Math.ceil(totalCount / numLimit)
  }, "Campaign details retrieved successfully"));
});

