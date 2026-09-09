import WarehouseOrder from '../../models/warehouseOrder.model.js';
import ProductFlat from '../../models/productFlat.model.js';
import Warehouse from '../../models/warehouse.model.js';
import Merchant from '../../models/merchant.model.js';
import { getIO } from '../../config/socket.js';
import { emitWarehouseOrderUpdate } from '../../sockets/warehouseOrder.socket.js';
import { enqueueOrder } from '../../helperFns/orderFns.js';
import { inferZone } from '../../utils/zoneInfer.js';
import { storageService } from '../../services/storage.service.js';
import { cancelAndCleanupOrder } from '../../helperFns/orderCancellationHelper.js';

const generateOTP = () => Math.floor(1000 + Math.random() * 9000);

/**
 * GET /merchant/warehouse-orders/placed
 * Get all placed (pending acceptance) orders for this warehouse operator.
 */
export const getWarehousePlacedOrders = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const orders = await WarehouseOrder.find({
      warehouseId: merchant.warehouseId,
      orderStatus: 'placed',
      fulfillmentType: 'try_and_buy',
    })
      .select('orderStatus items totalAmount deliveryRiderStatus createdAt deliveryLocation userId')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ orders });
  } catch (error) {
    console.error('getWarehousePlacedOrders error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /merchant/warehouse-orders/all
 * Get all warehouse orders for this operator (any status).
 */
export const getAllWarehouseOrdersForOperator = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse') {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const { orderStatus, page = 1, limit = 20 } = req.query;
    const filter = { warehouseId: merchant.warehouseId };
    if (orderStatus) filter.orderStatus = orderStatus;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      WarehouseOrder.find(filter)
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      WarehouseOrder.countDocuments(filter),
    ]);

    return res.status(200).json({ orders, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getAllWarehouseOrdersForOperator error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /merchant/warehouse-orders/:orderId
 * Get detail of a single warehouse order.
 */
export const getWarehouseOrderDetailForOperator = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse') {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const order = await WarehouseOrder.findOne({
      _id: req.params.orderId,
      warehouseId: merchant.warehouseId,
    })
      .populate('userId', 'name phone email')
      .populate('deliveryRiderId', 'name phone')
      .lean();

    if (!order) return res.status(404).json({ message: 'Order not found' });

    return res.status(200).json({ order });
  } catch (error) {
    console.error('getWarehouseOrderDetail error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /merchant/warehouse-orders/:orderId/accept
 * Warehouse operator accepts the order → queues for rider assignment.
 */
export const acceptWarehouseOrder = async (req, res) => {
  try {
    const io = getIO();
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse') {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const order = await WarehouseOrder.findOne({
      _id: req.params.orderId,
      warehouseId: merchant.warehouseId,
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.orderStatus !== 'placed') {
      return res.status(400).json({ message: `Cannot accept order in status: ${order.orderStatus}` });
    }

    order.orderStatus = 'accepted';
    order.customerDeliveryStatus = 'accepted';

    // Queue for rider assignment
    if (order.fulfillmentType === 'try_and_buy') {
      const pickupCoords = order.pickupLocation?.coordinates;
      const deliveryCoords = order.deliveryLocation?.coordinates;

      if (pickupCoords && deliveryCoords) {
        const zoneId = await inferZone(pickupCoords[1], pickupCoords[0]);

        const queueResult = await enqueueOrder({
          orderId: order._id.toString(),
          merchantId: merchant._id.toString(), // warehouse operator acts as the "merchant"
          zoneId,
          pickupLat: pickupCoords[1],
          pickupLng: pickupCoords[0],
          customerLat: deliveryCoords[1],
          customerLng: deliveryCoords[0],
          isWarehouseOrder: true,
        });

        if (queueResult.success) {
          order.deliveryRiderStatus = 'queued';
        }
      }
    }

    await order.save();

    await emitWarehouseOrderUpdate(io, merchant.warehouseId, order._id.toString(), order);

    return res.status(200).json({ success: true, order, message: 'Order accepted and queued for rider' });
  } catch (error) {
    console.error('acceptWarehouseOrder error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /merchant/warehouse-orders/:orderId/reject
 * Warehouse operator rejects the order.
 */
export const rejectWarehouseOrder = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse') {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const order = await WarehouseOrder.findOne({
      _id: req.params.orderId,
      warehouseId: merchant.warehouseId,
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const result = await cancelAndCleanupOrder({
      orderId: order._id,
      cancelledBy: 'merchant',
      reason: req.body.reason || 'Rejected by warehouse operator',
      action: 'rejected',
      req,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({ message: result.error || 'Failed to reject order' });
    }

    return res.status(200).json({
      success: true,
      message: 'Order rejected, stock released, and resources cleaned up',
      order: result.order,
      refundAmount: result.refundAmount,
    });
  } catch (error) {
    console.error('rejectWarehouseOrder error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /merchant/warehouse-orders/:orderId/packed
 * Mark order as packed with OTP generated for rider pickup.
 */
export const markWarehouseOrderPacked = async (req, res) => {
  try {
    const io = getIO();
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse') {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const order = await WarehouseOrder.findOne({
      _id: req.params.orderId,
      warehouseId: merchant.warehouseId,
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.orderStatus !== 'accepted') {
      return res.status(400).json({ message: `Cannot pack order in status: ${order.orderStatus}` });
    }

    order.orderStatus = 'packed';
    order.otp = String(generateOTP());
    await order.save();

    await emitWarehouseOrderUpdate(io, merchant.warehouseId, order._id.toString(), order);

    return res.status(200).json({ success: true, otp: order.otp, message: 'Order marked as packed' });
  } catch (error) {
    console.error('markWarehouseOrderPacked error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /merchant/warehouse-orders/:orderId/packing-photo
 * Upload packing photos for a warehouse order.
 */
export const uploadWarehousePackingPhoto = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse') {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const order = await WarehouseOrder.findOne({
      _id: req.params.orderId,
      warehouseId: merchant.warehouseId,
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const uploaded = await storageService.upload(req.file, 'warehouse-packing-photos');
    order.packingPhotos.push({
      url: uploaded.url,
      public_id: uploaded.public_id,
      uploadedAt: new Date(),
    });
    await order.save();

    return res.status(200).json({ success: true, packingPhotos: order.packingPhotos });
  } catch (error) {
    console.error('uploadWarehousePackingPhoto error:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /merchant/warehouse-orders/stats
 * Dashboard stats for the warehouse operator.
 */
export const getWarehouseOperatorStats = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant || merchant.accountType !== 'warehouse') {
      return res.status(403).json({ message: 'Not a warehouse operator' });
    }

    const warehouseId = merchant.warehouseId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, todayOrders, pendingOrders, completedOrders] = await Promise.all([
      WarehouseOrder.countDocuments({ warehouseId }),
      WarehouseOrder.countDocuments({ warehouseId, createdAt: { $gte: today } }),
      WarehouseOrder.countDocuments({ warehouseId, orderStatus: 'placed' }),
      WarehouseOrder.countDocuments({ warehouseId, orderStatus: { $in: ['completed', 'delivered'] } }),
    ]);

    const revenueAgg = await WarehouseOrder.aggregate([
      { $match: { warehouseId: merchant.warehouseId, orderStatus: { $in: ['completed', 'delivered', 'selection_made'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    return res.status(200).json({
      stats: {
        totalOrders,
        todayOrders,
        pendingOrders,
        completedOrders,
        totalRevenue: revenueAgg[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('getWarehouseOperatorStats error:', error);
    return res.status(500).json({ message: error.message });
  }
};
