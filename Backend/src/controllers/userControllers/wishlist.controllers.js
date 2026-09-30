// controllers/wishlistController.js
import asyncHandler from 'express-async-handler';
import Wishlist from '../../models/wishlist.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import ProductFlat from "../../models/productFlat.model.js";
import Brand from '../../models/brand.model.js';
import Merchant from '../../models/merchant.model.js';
import Category from '../../models/category.model.js';
import Warehouse from '../../models/warehouse.model.js';
import { generateColorVariantId } from "../../utils/variantAdapter.js";
import mongoose from 'mongoose';

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId, variantId } = req.body;
  const userId = req.user.userId;

  if (!productId || !variantId) {
    throw new ApiError(400, 'productId and variantId are required');
  }

  const matchingFlatVariants = await ProductFlat.find({
    $or: [
      { styleGroupId: productId },
      ...(mongoose.Types.ObjectId.isValid(productId) ? [{ _id: productId }] : []),
      ...(mongoose.Types.ObjectId.isValid(variantId) ? [{ _id: variantId }] : []),
    ],
    isDeleted: { $ne: true }
  });
  const matchedDocs = matchingFlatVariants.filter(v => 
    v._id.toString() === variantId.toString() || 
    generateColorVariantId(v.styleGroupId || productId, v.color?.name) === variantId.toString()
  );
  if (!matchedDocs.length && matchingFlatVariants.length > 0) {
    // Fallback to first matching document if color variant ID didn't match strictly
    matchedDocs.push(matchingFlatVariants[0]);
  }
  if (!matchedDocs.length) {
    throw new ApiError(404, 'Product or variant not found');
  }
  const baseDoc = matchedDocs[0];
  const canonicalProductId = baseDoc.styleGroupId ? baseDoc.styleGroupId.toString() : productId.toString();
  const canonicalVariantId = generateColorVariantId(canonicalProductId, baseDoc.color?.name || 'Default');
  
  // Check if this product or variant is already in the user's wishlist
  const exists = await Wishlist.findOne({
    userId,
    $or: [
      { productId: canonicalProductId },
      { variantId: canonicalVariantId },
      { variantId: variantId.toString() },
      ...(mongoose.Types.ObjectId.isValid(baseDoc._id) ? [{ variantId: baseDoc._id }] : [])
    ]
  });
  if (exists) {
    return res.status(200).json(new ApiResponse(200, exists, 'Product is already in wishlist'));
  }

  const wishlistItem = await Wishlist.create({
    userId,
    productId: canonicalProductId,
    variantId: canonicalVariantId,
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
});


// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { wishlistItemId } = req.params; // may be document _id, productId, or variantId
  const userId = req.user.userId;

  let deleted = null;
  if (mongoose.Types.ObjectId.isValid(wishlistItemId)) {
    deleted = await Wishlist.findOneAndDelete({
      _id: wishlistItemId,
      userId,
    });
  }

  // If not deleted by _id, try finding and deleting by productId or variantId
  if (!deleted) {
    deleted = await Wishlist.findOneAndDelete({
      userId,
      $or: [
        { productId: wishlistItemId },
        { variantId: wishlistItemId }
      ]
    });
  }

  if (!deleted) {
    throw new ApiError(404, 'Wishlist item not found or does not belong to you');
  }

  // Clean up any other duplicates of this product for this user
  if (deleted.productId) {
    await Wishlist.deleteMany({
      userId,
      productId: deleted.productId
    });
  }

  res.json(new ApiResponse(200, null, 'Item removed from wishlist'));
});

// @desc    Get logged in user's wishlist with product details
// @route   GET /api/wishlist
// @access  Private
export const getMyWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const wishlist = await Wishlist.find({ userId }).sort({ createdAt: -1 }).lean();
  const result = [];
  const seenProductIds = new Set();

  for (const item of wishlist) {
    if (!item.productId) continue;
    const styleGroupId = item.productId.toString();

    // Deduplicate by styleGroupId so duplicate cards never show in wishlist
    if (seenProductIds.has(styleGroupId)) {
      continue;
    }
    seenProductIds.add(styleGroupId);

    const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
    const nearbyWhSet = new Set(req.nearbyWarehouseIds?.map(id => id.toString()) || []);

    const siblings = await ProductFlat.find({ styleGroupId, isDeleted: { $ne: true } })
      .populate('brandId', 'name logo')
      .populate('categoryId', 'name')
      .populate('merchantId', 'shopName isOnline isZoneLive fulfillmentType')
      .lean();

    if (siblings.length > 0) {
      const matched = siblings.find(
        (v) => (item.variantId && v._id?.toString() === item.variantId?.toString()) ||
               (v.color?.name && generateColorVariantId(styleGroupId, v.color.name) === item.variantId?.toString())
      ) || siblings[0];

      const merchantObj = (typeof matched.merchantId === 'object' && matched.merchantId !== null) ? matched.merchantId : null;
      const merchantIdVal = merchantObj?._id || matched.merchantId;

      const isWh = matched.source === 'warehouse' || !!matched.warehouseId || merchantObj?.fulfillmentType === 'warehouse';
      const isWhNearby = matched.warehouseId ? nearbyWhSet.has(matched.warehouseId.toString()) : (isWh && nearbyWhSet.size > 0);

      const isMerchantNearby = merchantIdVal ? nearbySet.has(merchantIdVal.toString()) : false;
      const isNearby = isWh ? isWhNearby : isMerchantNearby;
      const isOnline = isWh ? true : (merchantObj?.isOnline !== undefined ? merchantObj.isOnline : true);
      const isZoneLive = isWh ? true : (merchantObj?.isZoneLive !== undefined ? merchantObj.isZoneLive : true);
      const isInstantBuyable = isWh ? isWhNearby : (isNearby && isOnline && isZoneLive);

      const totalStock = siblings.reduce((sum, s) => sum + Math.max(0, (s.stock || 0) - (s.reservedStock || 0)), 0);

      const canonicalVariantId = generateColorVariantId(styleGroupId, matched.color?.name || 'Default');

      result.push({
        _id: item._id,
        product: {
          ...matched,
          _id: styleGroupId, // Re-map _id to styleGroupId so Customer App routes & context check matches correctly
          variantId: canonicalVariantId, // Explicitly pass canonical variantId for mobile App heart icon checks
          isNearby,
          isInstantBuyable,
          isWarehouseListing: isWh,
          source: isWh ? 'warehouse' : (matched.source || 'shop'),
          isOnline,
          stock: totalStock,
          totalStock,
          inStock: totalStock > 0,
        },
        addedAt: item.createdAt,
      });
    }
  }

  return res.json(new ApiResponse(200, {
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

  const result = [];
  const seenProductIds = new Set();

  for (const item of wishlist) {
    const pId = item.productId?.toString();
    if (!pId || seenProductIds.has(pId)) continue;
    seenProductIds.add(pId);

    result.push({
      _id: item._id,
      productId: pId,
      variantId: item.variantId?.toString(),
    });
  }

  res.json(new ApiResponse(200, {
    count: result.length,
    wishlistIds: result,
  }, "Wishlist IDs retrieved"));
});
