import asyncHandler from 'express-async-handler';
import RecentlyViewed from '../../models/recentlyViewed.model.js';
import Product from '../../models/product.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';

// @desc    Add product to recently viewed
// @route   POST /api/user/recently-viewed/add
// @access  Private
export const addToRecentlyViewed = asyncHandler(async (req, res) => {
  const { productId, variantId } = req.body;
  const userId = req.user.userId;

  if (!productId || !variantId) {
    throw new ApiError(400, 'productId and variantId are required');
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  // Upsert the recently viewed record
  // If it exists for (userId, productId), it will update the variantId and timestamps (updatedAt)
  await RecentlyViewed.findOneAndUpdate(
    { userId, productId },
    { variantId, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  // Maintain the limit of 20 items
  const count = await RecentlyViewed.countDocuments({ userId });
  if (count > 20) {
    const oldestItems = await RecentlyViewed.find({ userId })
      .sort({ updatedAt: 1 })
      .limit(count - 20);
    
    const oldestIds = oldestItems.map(item => item._id);
    await RecentlyViewed.deleteMany({ _id: { $in: oldestIds } });
  }

  res.status(200).json(new ApiResponse(200, null, 'Added to recently viewed'));
});

// @desc    Get current user's recently viewed products
// @route   GET /api/user/recently-viewed/my
// @access  Private
export const getMyRecentlyViewed = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const recentlyViewedItems = await RecentlyViewed.find({ userId })
    .populate({
      path: 'productId',
      select: 'name brandId ratings isTriable variants',
      populate: {
        path: 'brandId',
        select: 'name',
      },
    })
    .sort({ updatedAt: -1 })
    .limit(20);

  // Map to a cleaner format for frontend
  const products = recentlyViewedItems
    .filter(item => item.productId) // Filter out if product was deleted
    .map(item => {
      const product = item.productId;
      const variant = product.variants.id(item.variantId) || product.variants[0];

      return {
        _id: product._id,
        id: product._id,
        name: product.name,
        brand: product.brandId?.name,
        price: variant?.price,
        mrp: variant?.mrp,
        images: variant?.images,
        ratings: product.ratings,
        isTriable: product.isTriable,
        variantId: item.variantId,
      };
    });

  res.status(200).json(new ApiResponse(200, products, 'Recently viewed retrieved'));
});
