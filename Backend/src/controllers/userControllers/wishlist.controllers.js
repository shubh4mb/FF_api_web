// controllers/wishlistController.js
import asyncHandler from 'express-async-handler';
import Wishlist from '../../models/wishlist.model.js';
import Product from "../../models/product.model.js";
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';

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

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
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


  const wishlist = await Wishlist.find({ userId })
    .populate({
      path: 'productId',
      match: { isActive: true },
      select: 'name brandId categoryId gender variants',
      populate: [
        { path: 'brandId', select: 'name logo' },
        { path: 'categoryId', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 });

  const result = wishlist
    .filter(item => item.productId)
    .map(item => {
      const variant =
        item.productId.variants.id(item.variantId) ||
        item.variantSnapshot;

      return {
        _id: item._id,
        product: {
          _id: item.productId._id,
          name: item.productId.name,
          brand: item.productId.brandId,
          category: item.productId.categoryId,
          gender: item.productId.gender,
          variant,
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
    .select('productId variantId')
    .sort({ createdAt: -1 });

  const result = wishlist.map(item => ({
    productId: item.productId,
    variantId: item.variantId,
  }));

  res.json(new ApiResponse(200, {
    count: result.length,
    wishlistIds: result,
  }, "Wishlist IDs retrieved"));
});


// @desc    Check if a product is in user's wishlist (useful for frontend heart icon)
// @route   GET /api/wishlist/check/:productId
// @access  Private
// export const isProductInWishlist = asyncHandler(async (req, res) => {
//   const { productId } = req.params;
//   const userId = req.user.userId;

//   const exists = await Wishlist.exists({ userId, productId });
//   res.json({ inWishlist: !!exists });
// });

