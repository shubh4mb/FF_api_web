import WarehouseOrder from '../../models/warehouseOrder.model.js';
import Product from '../../models/product.model.js';
import Merchant from '../../models/merchant.model.js';
import WeeklyPayout from '../../models/weeklyPayout.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import mongoose from 'mongoose';

/**
 * GET /admin/warehouse/orders
 * List all warehouse orders with filters
 */
export const getAllWarehouseOrders = asyncHandler(async (req, res) => {
  const {
    warehouseId,
    fulfillmentType,
    orderStatus,
    settlementStatus,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = {};
  if (warehouseId) filter.warehouseId = warehouseId;
  if (fulfillmentType) filter.fulfillmentType = fulfillmentType;
  if (orderStatus) filter.orderStatus = orderStatus;
  if (settlementStatus) filter.settlementStatus = settlementStatus;

  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    WarehouseOrder.find(filter)
      .populate('userId', 'name phone')
      .populate('warehouseId', 'name code')
      .populate('sourceMerchantId', 'shopName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    WarehouseOrder.countDocuments(filter),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, { orders, total, page: Number(page), limit: Number(limit) }, 'Orders retrieved'));
});

/**
 * GET /admin/warehouse/orders/:orderId
 * Get full detail of a single warehouse order
 */
export const getWarehouseOrderById = asyncHandler(async (req, res) => {
  const order = await WarehouseOrder.findById(req.params.orderId)
    .populate('userId', 'name phone email')
    .populate('warehouseId', 'name code address')
    .populate('sourceMerchantId', 'shopName phoneNumber email')
    .populate('deliveryRiderId', 'name phone')
    .lean();

  if (!order) throw new ApiError(404, 'Warehouse order not found');

  return res.status(200).json(new ApiResponse(200, { order }, 'Order retrieved'));
});

/**
 * PATCH /admin/warehouse/orders/:orderId/status
 * Update order status (admin override)
 */
export const updateWarehouseOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, reason } = req.body;

  const validStatuses = [
    'placed', 'accepted', 'packed', 'cancelled', 'rejected',
    'in_transit', 'try_phase', 'selection_made', 'return_in_progress', 'completed',
    'confirmed', 'shipped', 'delivered', 'returned',
  ];

  if (!validStatuses.includes(orderStatus)) {
    throw new ApiError(400, `Invalid orderStatus. Must be one of: ${validStatuses.join(', ')}`);
  }

  const order = await WarehouseOrder.findByIdAndUpdate(
    req.params.orderId,
    { $set: { orderStatus, ...(reason ? { reason } : {}) } },
    { new: true }
  );

  if (!order) throw new ApiError(404, 'Warehouse order not found');

  return res
    .status(200)
    .json(new ApiResponse(200, { order }, 'Order status updated'));
});

/**
 * POST /admin/warehouse/orders/:orderId/settle
 * Settle a warehouse order — calculates and records merchant payout.
 * 
 * Commission chain:
 *   1. warehouseProduct.commissionRate (if set)
 *   2. warehouse.commissionRate (if set)
 *   3. appConfig.defaultWarehouseCommissionRate (fallback)
 */
export const settleWarehouseOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await WarehouseOrder.findById(req.params.orderId).session(session);
    if (!order) throw new ApiError(404, 'Warehouse order not found');

    if (order.settlementStatus === 'settled') {
      throw new ApiError(400, 'Order already settled');
    }

    if (!['completed', 'delivered', 'selection_made'].includes(order.orderStatus)) {
      throw new ApiError(400, 'Order must be completed/delivered before settlement');
    }

    const commissionAmount = order.commissionAmount || 0;
    const merchantPayoutAmount = order.merchantPayout || (order.totalAmount - commissionAmount);

    // ── Record in merchant's WeeklyPayout ──
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    await WeeklyPayout.findOneAndUpdate(
      {
        ownerType: 'merchant',
        ownerId: order.sourceMerchantId,
        weekStart,
      },
      {
        $setOnInsert: { ownerType: 'merchant', ownerId: order.sourceMerchantId, weekStart, weekEnd },
        $inc: { totalEarnings: merchantPayoutAmount, netPayout: merchantPayoutAmount },
        $push: {
          orders: {
            orderId: order._id,
            amount: merchantPayoutAmount,
            type: 'credit',
            description: `Warehouse sale (${order.warehouseDetails?.name || 'warehouse'}) — commission ${order.commissionRate}% deducted`,
            settledAt: now,
          },
        },
      },
      { upsert: true, session }
    );

    // ── Update merchant earnings ──
    await Merchant.findByIdAndUpdate(
      order.sourceMerchantId,
      { $inc: { 'earnings.pendingBalance': merchantPayoutAmount } },
      { session }
    );

    // ── Mark order as settled ──
    order.settlementStatus = 'settled';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { order, merchantPayout: merchantPayoutAmount },
          'Warehouse order settled and merchant payout recorded'
        )
      );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/**
 * GET /admin/warehouse/orders/stats
 * Quick stats: total orders, revenue, commission earned, pending settlements
 */
export const getWarehouseOrderStats = asyncHandler(async (req, res) => {
  const { warehouseId, from, to } = req.query;

  const matchStage = {};
  if (warehouseId) matchStage.warehouseId = new mongoose.Types.ObjectId(warehouseId);
  if (from || to) {
    matchStage.createdAt = {};
    if (from) matchStage.createdAt.$gte = new Date(from);
    if (to) matchStage.createdAt.$lte = new Date(to);
  }

  const stats = await WarehouseOrder.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalCommission: { $sum: '$commissionAmount' },
        totalMerchantPayout: { $sum: '$merchantPayout' },
        pendingSettlements: {
          $sum: { $cond: [{ $eq: ['$settlementStatus', 'unsettled'] }, 1, 0] },
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, { stats: stats[0] || {} }, 'Warehouse order stats'));
});
