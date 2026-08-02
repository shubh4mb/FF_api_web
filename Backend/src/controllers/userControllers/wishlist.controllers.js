// controllers/wishlistController.js
import asyncHandler from 'express-async-handler';
import Wishlist from '../../models/wishlist.model.js';
import Product from "../../models/product.model.js";
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import ProductFlat from "../../models/productFlat.model.js";
import { generateColorVariantId } from "../../utils/variantAdapter.js";

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId, variantId } = req.body;
  console.log(req.body);

  const userId = req.user.userId;

  if (!productId || !variantId) {
    throw new ApiError(400, 'productId and variantId are required');
  }

  if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
    const matchingFlatVariants = await ProductFlat.find({ styleGroupId: productId, isDeleted: { $ne: true } });
    const matchedDocs = matchingFlatVariants.filter(v => generateColorVariantId(productId, v.color.name) === variantId);
    if (!matchedDocs.length) {
      throw new ApiError(404, 'Product or variant not found');
    }
    const baseDoc = matchedDocs[0];
    
    const exists = await Wishlist.findOne({ userId, variantId });
    if (exists) {
      throw new ApiError(400, 'This variant is already in your wishlist');
    }

    const wishlistItem = await Wishlist.create({
      userId,
      productId,
      variantId,
      variantSnapshot: {
        color: baseDoc.color,
        size: baseDoc.size,
        price: baseDoc.price,
        mrp: baseDoc.mrp,
        discount: baseDoc.discount,
        image: baseDoc.images?.[0]?.url || '',
      },
    });

    return res.status(201).json(new ApiResponse(201, wishlistItem, 'Variant added to wishlist'));
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
    isVerified: true,
    'variants._id': variantId,
  });

  if (!product) {
    throw new ApiError(404, 'Product or variant not found');
  }

  const variant = product.variants.id(variantId);
  if (!variant) {
    throw new ApiError(404, 'Variant not found');
  }

  const exists = await Wishlist.findOne({ userId, variantId });
  if (exists) {
    throw new ApiError(400, 'This variant is already in your wishlist');
  }

  const wishlistItem = await Wishlist.create({
    userId,
    productId,
    variantId,
    variantSnapshot: {
      color: variant.color,
      size: variant.sizes?.[0]?.size || null,
      price: variant.price,
      mrp: variant.mrp,
      discount: variant.discount,
      image: variant.images?.[0]?.url || '',
    },
  });

  res.status(201).json(new ApiResponse(201, wishlistItem, 'Variant added to wishlist'));
});


// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { wishlistItemId } = req.params; // ← now we use the wishlist document _id
  const userId = req.user.userId;

  const deleted = await Wishlist.findOneAndDelete({
    _id: wishlistItemId,
    userId, // security: make sure user can only delete their own items
  });

  if (!deleted) {
    throw new ApiError(404, 'Wishlist item not found or does not belong to you');
  }

  res.json(new ApiResponse(200, null, 'Item removed from wishlist'));
});

// @desc    Get logged in user's wishlist with product details
// @route   GET /api/wishlist
// @access  Private
export const getMyWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  console.log(userId, 'userId');

  if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
    const wishlist = await Wishlist.find({ userId }).sort({ createdAt: -1 }).lean();
    const result = [];

    for (const item of wishlist) {
      if (!item.productId) continue;
      const styleGroupId = item.productId.toString();
      const siblings = await ProductFlat.find({ styleGroupId, isDeleted: { $ne: true } })
        .populate('brandId', 'name logo')
        .populate('categoryId', 'name')
        .populate('merchantId', 'isOnline isZoneLive')
        .lean();

      if (siblings.length > 0) {
        const matched = siblings.find(
          (v) => generateColorVariantId(styleGroupId, v.color.name) === item.variantId.toString()
        ) || siblings[0];

        const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
        const isNearby = matched.merchantId ? nearbySet.has(matched.merchantId._id?.toString() || matched.merchantId.toString()) : false;
        const isOnline = matched.merchantId?.isOnline !== undefined ? matched.merchantId.isOnline : true;
        const isZoneLive = matched.merchantId?.isZoneLive !== undefined ? matched.merchantId.isZoneLive : true;
        const isInstantBuyable = isNearby && isOnline && isZoneLive;

        result.push({
          _id: item._id,
          product: {
            ...matched,
            _id: styleGroupId, // Re-map _id to styleGroupId so Customer App routes & context check matches correctly
            variantId: item.variantId, // Explicitly pass variantId for mobile App heart icon checks
            isNearby,
            isInstantBuyable,
          },
          addedAt: item.createdAt,
        });
      }
    }

    return res.json(new ApiResponse(200, {
      count: result.length,
      wishlist: result,
    }, "Wishlist retrieved"));
  }

  const wishlist = await Wishlist.find({ userId })
    .populate({
      path: 'productId',
      match: { isActive: true, isVerified: true },
      select: 'name brandId categoryId gender variants merchantId',
      populate: [
        { path: 'brandId', select: 'name logo' },
        { path: 'categoryId', select: 'name' },
        { path: 'merchantId', select: 'isOnline isZoneLive' },
      ],
    })
    .sort({ createdAt: -1 });

  const result = wishlist
    .filter(item => item.productId)
    .map(item => {
      const variant =
        item.productId.variants.id(item.variantId) ||
        item.variantSnapshot;

      const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
      const isNearby = item.productId.merchantId ? nearbySet.has(item.productId.merchantId._id?.toString() || item.productId.merchantId.toString()) : false;
      const isOnline = item.productId.merchantId?.isOnline !== undefined ? item.productId.merchantId.isOnline : true;
      const isZoneLive = item.productId.merchantId?.isZoneLive !== undefined ? item.productId.merchantId.isZoneLive : true;
      const isInstantBuyable = isNearby && isOnline && isZoneLive;

      return {
        _id: item._id,
        product: {
          _id: item.productId._id,
          name: item.productId.name,
          brand: item.productId.brandId,
          category: item.productId.categoryId,
          gender: item.productId.gender,
          variant,
          isNearby,
          isInstantBuyable,
        },
        addedAt: item.createdAt,
      };
    });

  res.json(new ApiResponse(200, {
    count: result.length,
    wishlist: result,
  }, "Wishlist retrieved"));
});

// @desc    Get logged in user's wishlist with only product and variant IDs
// @route   GET /api/wishlist/ids
// @access  Private
export const getMyWishlistIds = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const wishlist = await Wishlist.find({ userId })
    .select('_id productId variantId')
    .sort({ createdAt: -1 });

  const result = wishlist.map(item => ({
    _id: item._id,
    productId: item.productId,
    variantId: item.variantId,
  }));

  res.json(new ApiResponse(200, {
    count: result.length,
    wishlistIds: result,
  }, "Wishlist IDs retrieved"));
});
