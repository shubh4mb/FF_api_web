import asyncHandler from 'express-async-handler';
import RecentlyViewed from '../../models/recentlyViewed.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import ProductFlat from '../../models/productFlat.model.js';
import Brand from '../../models/brand.model.js';
import Merchant from '../../models/merchant.model.js';
import Warehouse from '../../models/warehouse.model.js';
import { generateColorVariantId } from '../../utils/variantAdapter.js';

// @desc    Add product to recently viewed
// @route   POST /api/user/recently-viewed/add
// @access  Private
export const addToRecentlyViewed = asyncHandler(async (req, res) => {
  const { productId, variantId } = req.body;
  const userId = req.user.userId;

  if (!productId || !variantId) {
    throw new ApiError(400, 'productId and variantId are required');
  }

  const product = await ProductFlat.findOne({
    $or: [{ styleGroupId: productId }, { _id: productId }],
    isDeleted: { $ne: true }
  });
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  // Upsert the recently viewed record
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
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  const products = [];
  const nearbySet = new Set(req.nearbyMerchantIds?.map(id => id.toString()) || []);
  const nearbyWhSet = new Set(req.nearbyWarehouseIds?.map(id => id.toString()) || []);

  for (const item of recentlyViewedItems) {
    if (!item.productId) continue;
    const styleGroupId = item.productId.toString();
    const siblings = await ProductFlat.find({ styleGroupId, isDeleted: { $ne: true } })
      .populate('brandId', 'name')
      .populate('merchantId', 'shopName isOnline isZoneLive fulfillmentType')
      .lean();

    if (siblings.length > 0) {
      const matched = siblings.find(
        (v) => generateColorVariantId(styleGroupId, v.color?.name) === item.variantId.toString()
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

      products.push({
        _id: styleGroupId, // Re-map _id to styleGroupId so routing/details lookups work
        id: styleGroupId,
        name: matched.name,
        brand: matched.brandId?.name,
        brandId: matched.brandId?._id || matched.brandId,
        merchantId: merchantIdVal,
        warehouseId: matched.warehouseId,
        price: matched.price,
        mrp: matched.mrp,
        discount: matched.mrp && matched.mrp > matched.price ? Math.round(((matched.mrp - matched.price) / matched.mrp) * 100) : (matched.discount || 0),
        images: matched.images,
        color: matched.color,
        ratings: matched.ratings || 0,
        numReviews: matched.numReviews || 0,
        isTriable: matched.isTriable !== false,
        variantId: item.variantId,
        isNearby,
        isInstantBuyable,
        isWarehouseListing: isWh,
        source: isWh ? 'warehouse' : (matched.source || 'shop'),
        isOnline,
        stock: totalStock,
        totalStock,
        inStock: totalStock > 0,
      });
    }
  }

  return res.status(200).json(new ApiResponse(200, products, 'Recently viewed retrieved'));
});
