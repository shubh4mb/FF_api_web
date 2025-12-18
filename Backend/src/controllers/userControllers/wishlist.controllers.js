// controllers/wishlistController.js
import asyncHandler from 'express-async-handler';
import Wishlist from '../../models/wishlist.model.js';
import Product from "../../models/product.model.js";

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId, variantId } = req.body;
  console.log(req.body);
  
  const userId = req.user.userId;

  if (!productId || !variantId) {
    return res.status(400).json({ message: 'productId and variantId are required' });
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
    'variants._id': variantId,
  });

  if (!product) {
    return res.status(404).json({ message: 'Product or variant not found' });
  }

  const variant = product.variants.id(variantId);
  if (!variant) {
    return res.status(400).json({ message: 'Variant not found' });
  }

  const exists = await Wishlist.findOne({ userId, variantId });
  if (exists) {
    return res.status(400).json({
      message: 'This variant is already in your wishlist',
    });
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

  res.status(201).json({
    success: true,
    message: 'Variant added to wishlist',
    data: wishlistItem,
  });
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
    return res.status(404).json({
      message: 'Wishlist item not found or does not belong to you',
    });
  }

  res.json({
    success: true,
    message: 'Item removed from wishlist',
  });
});
// @desc    Get logged in user's wishlist with product details
// @route   GET /api/wishlist
// @access  Private
export const getMyWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

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

  res.json({
    success: true,
    count: result.length,
    data: result,
  });
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

  res.json({
    success: true,
    count: result.length,
    data: result,
  });
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

