import mongoose from 'mongoose';
import Collection from '../../models/collection.model.js';
import ProductFlat from '../../models/productFlat.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { storageService } from '../../services/storage.service.js';

const safeJsonParse = (val, fallback = undefined) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val !== undefined ? val : fallback;
};

// Create a new collection / campaign
export const createCollection = asyncHandler(async (req, res) => {
  try {
    const body = req.body || {};
    const { name, description, priority, isActive, tagline, campaignType, badgeText, attachedCouponCode } = body;

    if (!name) {
      throw new ApiError(400, "Collection data (name) is required");
    }

    const theme = safeJsonParse(body.theme, {
      primaryColor: '#0EA5E9',
      secondaryColor: '#2563EB',
      bgGradientStart: '#FFFFFF',
      bgGradientEnd: '#F8FAFC',
      textColor: '#0F172A',
      presetName: 'default'
    });

    const schedule = safeJsonParse(body.schedule, {
      isScheduled: false,
      startDate: null,
      endDate: null
    });

    const smartRules = safeJsonParse(body.smartRules, {
      categoryIds: [],
      subCategoryIds: [],
      tags: [],
      keywords: [],
      colorKeywords: [],
      genders: [],
      maxPrice: null
    });

    const subCurations = safeJsonParse(body.subCurations, []);
    const pinnedProductIds = safeJsonParse(body.pinnedProductIds, []);

    let bannerImage = { public_id: '', url: '' };
    let heroBannerImage = { public_id: '', url: '' };

    if (req.files) {
      if (req.files.bannerImage?.[0]) {
        const uploadResult = await storageService.uploadSingle(req.files.bannerImage[0], 'collections');
        bannerImage = { public_id: uploadResult.public_id, url: uploadResult.url };
      }
      if (req.files.heroBannerImage?.[0]) {
        const uploadResult = await storageService.uploadSingle(req.files.heroBannerImage[0], 'collections');
        heroBannerImage = { public_id: uploadResult.public_id, url: uploadResult.url };
      }
    } else if (req.file) {
      const uploadResult = await storageService.uploadSingle(req.file, 'collections');
      bannerImage = { public_id: uploadResult.public_id, url: uploadResult.url };
    }

    const collection = await Collection.create({
      name,
      tagline: tagline || '',
      description: description || '',
      campaignType: campaignType || 'curated',
      badgeText: badgeText || '',
      bannerImage,
      heroBannerImage,
      theme,
      schedule,
      smartRules,
      subCurations,
      attachedCouponCode: attachedCouponCode || '',
      pinnedProductIds,
      priority: priority !== undefined ? Number(priority) : 0,
      isActive: isActive === 'true' || isActive === true || isActive === undefined,
    });

    res.status(201).json(new ApiResponse(201, { collection }, "Collection / Campaign created successfully"));
  } catch (error) {
    console.error('Create collection error:', error);
    if (error.code === 11000) {
      res.status(400).json(new ApiResponse(400, null, "A collection with this name already exists"));
    } else {
      res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
    }
  }
});

// Get all collections
export const getAllCollections = asyncHandler(async (req, res) => {
  try {
    const collections = await Collection.find()
      .populate('smartRules.categoryIds', 'name')
      .populate('smartRules.subCategoryIds', 'name')
      .populate('subCurations.categoryId', 'name')
      .sort({ priority: -1, createdAt: -1 });

    res.status(200).json(new ApiResponse(200, { collections }, "Collections retrieved successfully"));
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json(new ApiResponse(500, null, error.message));
  }
});

// Get single collection by ID
export const getCollectionById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findById(id)
      .populate('smartRules.categoryIds', 'name')
      .populate('smartRules.subCategoryIds', 'name')
      .populate('subCurations.categoryId', 'name');

    if (!collection) {
      throw new ApiError(404, "Collection not found");
    }

    res.status(200).json(new ApiResponse(200, { collection }, "Collection retrieved successfully"));
  } catch (error) {
    console.error('Get collection by ID error:', error);
    res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
  }
});

// Update a collection
export const updateCollection = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const collection = await Collection.findById(id);
    if (!collection) {
      throw new ApiError(404, "Collection not found");
    }

    if (body.name) collection.name = body.name;
    if (body.tagline !== undefined) collection.tagline = body.tagline;
    if (body.description !== undefined) collection.description = body.description;
    if (body.campaignType) collection.campaignType = body.campaignType;
    if (body.badgeText !== undefined) collection.badgeText = body.badgeText;
    if (body.attachedCouponCode !== undefined) collection.attachedCouponCode = body.attachedCouponCode;
    if (body.priority !== undefined) collection.priority = Number(body.priority);
    if (body.isActive !== undefined) collection.isActive = body.isActive === 'true' || body.isActive === true;

    if (body.theme !== undefined) {
      collection.theme = { ...collection.theme, ...safeJsonParse(body.theme, collection.theme) };
    }
    if (body.schedule !== undefined) {
      collection.schedule = safeJsonParse(body.schedule, collection.schedule);
    }
    if (body.smartRules !== undefined) {
      collection.smartRules = safeJsonParse(body.smartRules, collection.smartRules);
    }
    if (body.subCurations !== undefined) {
      collection.subCurations = safeJsonParse(body.subCurations, collection.subCurations);
    }
    if (body.pinnedProductIds !== undefined) {
      collection.pinnedProductIds = safeJsonParse(body.pinnedProductIds, collection.pinnedProductIds);
    }

    // Handle Image Uploads
    if (req.files) {
      if (req.files.bannerImage?.[0]) {
        if (collection.bannerImage?.public_id) {
          await storageService.deleteFile(collection.bannerImage.public_id).catch(() => {});
        }
        const uploadResult = await storageService.uploadSingle(req.files.bannerImage[0], 'collections');
        collection.bannerImage = { public_id: uploadResult.public_id, url: uploadResult.url };
      }
      if (req.files.heroBannerImage?.[0]) {
        if (collection.heroBannerImage?.public_id) {
          await storageService.deleteFile(collection.heroBannerImage.public_id).catch(() => {});
        }
        const uploadResult = await storageService.uploadSingle(req.files.heroBannerImage[0], 'collections');
        collection.heroBannerImage = { public_id: uploadResult.public_id, url: uploadResult.url };
      }
    } else if (req.file) {
      if (collection.bannerImage?.public_id) {
        await storageService.deleteFile(collection.bannerImage.public_id).catch(() => {});
      }
      const uploadResult = await storageService.uploadSingle(req.file, 'collections');
      collection.bannerImage = { public_id: uploadResult.public_id, url: uploadResult.url };
    }

    await collection.save();

    res.status(200).json(new ApiResponse(200, { collection }, "Collection updated successfully"));
  } catch (error) {
    console.error('Update collection error:', error);
    if (error.code === 11000) {
      res.status(400).json(new ApiResponse(400, null, "A collection with this name already exists"));
    } else {
      res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
    }
  }
});

// Delete a collection
export const deleteCollection = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findById(id);

    if (!collection) {
      throw new ApiError(404, "Collection not found");
    }

    if (collection.bannerImage?.public_id) {
      await storageService.deleteFile(collection.bannerImage.public_id).catch(() => {});
    }
    if (collection.heroBannerImage?.public_id) {
      await storageService.deleteFile(collection.heroBannerImage.public_id).catch(() => {});
    }

    // Pull collectionId from ProductFlat
    await ProductFlat.updateMany(
      { collectionIds: id },
      { $pull: { collectionIds: id } }
    );

    await Collection.findByIdAndDelete(id);

    res.status(200).json(new ApiResponse(200, null, "Collection deleted successfully"));
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json(new ApiResponse(500, null, error.message));
  }
});

// Admin Product Inspector: Get all products currently inside/matching this collection
export const getCollectionProductsAdmin = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { search, page = 1, limit = 50 } = req.query;

    const collection = await Collection.findById(id);
    if (!collection) {
      throw new ApiError(404, "Collection not found");
    }

    const orClauses = [
      { collectionIds: new mongoose.Types.ObjectId(id) }
    ];

    // Add smartRules conditions
    const rules = collection.smartRules || {};
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
      isDeleted: { $ne: true },
      $or: orClauses,
    };

    if (collection.excludedProductIds?.length > 0) {
      query._id = { $nin: collection.excludedProductIds };
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, totalCount] = await Promise.all([
      ProductFlat.find(query)
        .populate('merchantId', 'storeName brandName')
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ProductFlat.countDocuments(query)
    ]);

    const pinnedSet = new Set((collection.pinnedProductIds || []).map(p => p.toString()));
    const collectionIdStr = id.toString();

    // Group by styleGroupId and format
    const styleMap = new Map();
    products.forEach(p => {
      if (!styleMap.has(p.styleGroupId)) {
        const isPinned = pinnedSet.has(p._id.toString()) || pinnedSet.has(p.styleGroupId);
        const isDirectTagged = (p.collectionIds || []).some(c => c.toString() === collectionIdStr);

        styleMap.set(p.styleGroupId, {
          _id: p._id,
          styleGroupId: p.styleGroupId,
          name: p.name,
          price: p.price,
          mrp: p.mrp,
          images: p.images,
          color: p.color,
          merchant: p.merchantId,
          category: p.categoryId,
          isPinned,
          matchType: isDirectTagged ? 'merchant_nominated' : 'rule_matched'
        });
      }
    });

    const formattedList = Array.from(styleMap.values());

    res.status(200).json(new ApiResponse(200, {
      products: formattedList,
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit))
    }, "Collection products retrieved successfully"));
  } catch (error) {
    console.error('Get collection products admin error:', error);
    res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
  }
});

// Admin Pin/Unpin Product in Collection
export const togglePinProduct = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;

    const collection = await Collection.findById(id);
    if (!collection) throw new ApiError(404, "Collection not found");

    const pIdStr = productId.toString();
    const isPinned = (collection.pinnedProductIds || []).some(p => p.toString() === pIdStr);

    if (isPinned) {
      collection.pinnedProductIds = collection.pinnedProductIds.filter(p => p.toString() !== pIdStr);
    } else {
      collection.pinnedProductIds.push(productId);
    }

    await collection.save();

    res.status(200).json(new ApiResponse(200, {
      isPinned: !isPinned,
      pinnedProductIds: collection.pinnedProductIds
    }, isPinned ? "Product unpinned" : "Product pinned to top"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
  }
});

// Admin Exclude Product from Collection (Spam Removal)
export const excludeProduct = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, styleGroupId } = req.body;

    const collection = await Collection.findById(id);
    if (!collection) throw new ApiError(404, "Collection not found");

    if (productId) {
      collection.excludedProductIds.addToSet(productId);
    }

    // Also pull collectionId from ProductFlat
    const pullFilter = styleGroupId ? { styleGroupId } : { _id: productId };
    await ProductFlat.updateMany(pullFilter, { $pull: { collectionIds: id } });

    await collection.save();

    res.status(200).json(new ApiResponse(200, null, "Product removed and excluded from collection"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
  }
});

// Admin Bulk Add Products to Collection
export const bulkAddProducts = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { productIds, styleGroupIds } = req.body;

    const collection = await Collection.findById(id);
    if (!collection) throw new ApiError(404, "Collection not found");

    let filter = {};
    if (productIds && productIds.length > 0) {
      filter._id = { $in: productIds };
    } else if (styleGroupIds && styleGroupIds.length > 0) {
      filter.styleGroupId = { $in: styleGroupIds };
    } else {
      throw new ApiError(400, "productIds or styleGroupIds required");
    }

    await ProductFlat.updateMany(filter, { $addToSet: { collectionIds: id } });

    // Also remove from excluded if previously excluded
    if (productIds) {
      collection.excludedProductIds = collection.excludedProductIds.filter(
        p => !productIds.includes(p.toString())
      );
      await collection.save();
    }

    res.status(200).json(new ApiResponse(200, null, "Products successfully added to collection"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
  }
});

