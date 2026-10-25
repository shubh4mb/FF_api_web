import Order from "../../models/order.model.js";
import WarehouseOrder from "../../models/warehouseOrder.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import PendingOrder from "../../models/pendingOrders.model.js";
import Merchant from "../../models/merchant.model.js";
import Warehouse from "../../models/warehouse.model.js";
import User from "../../models/user.model.js";
import { getIO } from "../../config/socket.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { emitWarehouseOrderUpdate } from "../../sockets/warehouseOrder.socket.js";
import { logAuditEvent } from "../../utils/auditLogger.js";
import { cancelAndCleanupOrder } from "../../helperFns/orderCancellationHelper.js";

/**
 * Get all orders with a pending cancellation request from a merchant or warehouse
 */
export const getCancellationRequests = async (req, res) => {
  try {
    const [orders, warehouseOrders] = await Promise.all([
      Order.find({ cancellationRequest: 'pending' })
        .populate('merchantId', 'shopName')
        .populate('userId', 'name phone')
        .sort({ updatedAt: -1 })
        .lean(),
      WarehouseOrder.find({ cancellationRequest: 'pending' })
        .populate('warehouseId', 'name code')
        .populate('sourceMerchantId', 'shopName')
        .populate('userId', 'name phone')
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const formattedWarehouseOrders = warehouseOrders.map(wo => ({
      ...wo,
      isWarehouseOrder: true,
      merchantId: {
        _id: wo.warehouseId?._id || wo.sourceMerchantId?._id,
        shopName: wo.warehouseId?.name || wo.sourceMerchantId?.shopName || 'Warehouse',
      },
    }));

    const allRequests = [...orders, ...formattedWarehouseOrders].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    return res.status(200).json({ success: true, orders: allRequests });
  } catch (error) {
    console.error("Get Cancellation Requests Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Approve or reject a merchant/warehouse cancellation request
 */
export const adminCancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  try {
    let order = await Order.findById(orderId);
    let isWarehouseOrder = false;

    if (!order) {
      order = await WarehouseOrder.findById(orderId);
      if (order) isWarehouseOrder = true;
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (action === 'reject') {
      order.cancellationRequest = 'rejected';
      await order.save();
      
      await logAuditEvent({
        action: "ORDER_CANCELLATION_REJECTED",
        message: `Admin rejected cancellation request for order #${order._id.toString().slice(-5).toUpperCase()}`,
        status: "info",
        orderId: order._id,
        userId: order.userId,
        merchantId: order.merchantId || order.warehouseId,
        req,
      });

      const io = getIO();
      emitOrderUpdate(io, orderId, order);
      if (isWarehouseOrder) {
        emitWarehouseOrderUpdate(io, order.warehouseId, orderId, order);
      }

      return res.status(200).json({ success: true, message: "Cancellation request rejected", order });
    }

    if (action === 'approve') {
      const result = await cancelAndCleanupOrder({
        orderId,
        cancelledBy: 'admin',
        reason: req.body.reason || 'Admin approved cancellation request',
        action: 'cancelled',
        req,
      });

      if (!result.success) {
        return res.status(result.statusCode || 400).json({ success: false, message: result.error });
      }

      return res.status(200).json({
        success: true,
        message: result.message || "Order cancelled successfully and resources freed",
        order: result.order,
      });
    }

    return res.status(400).json({ success: false, message: "Invalid action. Must be 'approve' or 'reject'" });

  } catch (error) {
    console.error("Admin Cancel Order Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get all orders where a rider was reported as unresponsive
 */
export const getUnresponsiveRiderReports = async (req, res) => {
  try {
    const [orders, warehouseOrders] = await Promise.all([
      Order.find({ 'riderUnresponsiveReport.status': 'pending' })
        .populate('merchantId', 'shopName')
        .populate('userId', 'name phone')
        .populate('deliveryRiderId', 'name phone')
        .sort({ 'riderUnresponsiveReport.reportedAt': -1 })
        .lean(),
      WarehouseOrder.find({ 'riderUnresponsiveReport.status': 'pending' })
        .populate('warehouseId', 'name code')
        .populate('userId', 'name phone')
        .populate('deliveryRiderId', 'name phone')
        .sort({ 'riderUnresponsiveReport.reportedAt': -1 })
        .lean(),
    ]);

    const formattedWarehouseOrders = warehouseOrders.map(wo => ({
      ...wo,
      isWarehouseOrder: true,
      merchantId: {
        _id: wo.warehouseId?._id,
        shopName: wo.warehouseId?.name || 'Warehouse',
      },
    }));

    const allReports = [...orders, ...formattedWarehouseOrders].sort(
      (a, b) =>
        new Date(b.riderUnresponsiveReport?.reportedAt || b.updatedAt) -
        new Date(a.riderUnresponsiveReport?.reportedAt || a.updatedAt)
    );

    return res.status(200).json({ success: true, orders: allReports });
  } catch (error) {
    console.error("Get Unresponsive Rider Reports Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Resolve an unresponsive rider report (either dismiss or cancel order)
 */
export const resolveUnresponsiveRider = async (req, res) => {
  const { orderId } = req.params;
  const { action } = req.body; // 'dismiss' or 'cancel_order'

  try {
    let order = await Order.findById(orderId);
    let isWarehouseOrder = false;

    if (!order) {
      order = await WarehouseOrder.findById(orderId);
      if (order) isWarehouseOrder = true;
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.riderUnresponsiveReport?.status !== 'pending') {
      return res.status(400).json({ success: false, message: "Report is not pending" });
    }

    if (action === 'dismiss') {
      order.riderUnresponsiveReport.status = 'resolved';
      await order.save();
      return res.status(200).json({ success: true, message: "Report dismissed", order });
    }

    if (action === 'cancel_order') {
      order.riderUnresponsiveReport.status = 'resolved';
      await order.save();

      const result = await cancelAndCleanupOrder({
        orderId,
        cancelledBy: 'admin',
        reason: 'Assigned rider was unresponsive',
        action: 'cancelled',
        req,
      });

      if (!result.success) {
        return res.status(result.statusCode || 400).json({ success: false, message: result.error });
      }

      return res.status(200).json({
        success: true,
        message: "Order cancelled successfully due to unresponsive rider",
        order: result.order,
      });
    }

    return res.status(400).json({ success: false, message: "Invalid action. Must be 'dismiss' or 'cancel_order'" });

  } catch (error) {
    console.error("Resolve Unresponsive Rider Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/orders
 * Master query for all orders across all merchants with socket-synced stats.
 * Supports filtering by merchantId, status, date, search, pagination.
 */
export const getAllAdminOrders = async (req, res) => {
  try {
    const { merchantId, status, search, page = 1, limit = 50, date } = req.query;

    const query = {};
    if (merchantId && merchantId !== 'all') {
      query.merchantId = merchantId;
    }
    if (status && status !== 'all') {
      if (status.includes(',')) {
        query.orderStatus = { $in: status.split(',').map(s => s.trim()) };
      } else {
        query.orderStatus = status;
      }
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    const [orders, warehouseOrders] = await Promise.all([
      Order.find(query)
        .populate('merchantId', 'shopName phoneNumber address logo fulfillmentType isOnline')
        .populate('userId', 'name phoneNumber email')
        .populate('deliveryRiderId', 'name phone currentStatus')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .lean(),
      WarehouseOrder.find(query)
        .populate('warehouseId', 'name code address phone')
        .populate('sourceMerchantId', 'shopName phoneNumber address logo')
        .populate('userId', 'name phoneNumber email')
        .populate('deliveryRiderId', 'name phone currentStatus')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .lean(),
    ]);

    const formattedWarehouseOrders = warehouseOrders.map(wo => ({
      ...wo,
      isWarehouseOrder: true,
      merchantId: wo.sourceMerchantId || {
        _id: wo.warehouseId?._id,
        shopName: wo.warehouseId?.name || 'Warehouse Hub',
        phoneNumber: wo.warehouseId?.phone,
        address: wo.warehouseId?.address,
      },
      merchantDetails: wo.merchantDetails?.name ? wo.merchantDetails : {
        name: wo.warehouseId?.name || wo.sourceMerchantId?.shopName || 'Warehouse Hub',
        phone: wo.warehouseId?.phone || wo.sourceMerchantId?.phoneNumber,
      }
    }));

    let combined = [...orders, ...formattedWarehouseOrders].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      combined = combined.filter(o => {
        const idStr = String(o._id || '').toLowerCase();
        const shortId = idStr.slice(-5);
        const custName = (o.userId?.name || o.deliveryLocation?.name || '').toLowerCase();
        const custPhone = (o.userId?.phoneNumber || o.deliveryLocation?.phone || '').toLowerCase();
        const merchName = (o.merchantId?.shopName || o.merchantDetails?.name || '').toLowerCase();
        const itemNames = (o.items || []).map(i => (i.name || '').toLowerCase()).join(' ');
        return idStr.includes(s) || shortId.includes(s) || custName.includes(s) || custPhone.includes(s) || merchName.includes(s) || itemNames.includes(s);
      });
    }

    const finalOrders = combined.slice(0, limitNum);

    // Compute live stats for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCount, placedCount, preparingCount, inTransitCount, completedTodayCount] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ orderStatus: 'placed' }),
      Order.countDocuments({ orderStatus: { $in: ['accepted', 'packed'] } }),
      Order.countDocuments({ orderStatus: { $in: ['in_transit', 'try_phase'] } }),
      Order.countDocuments({ orderStatus: 'completed', createdAt: { $gte: today } }),
    ]);

    return res.status(200).json({
      success: true,
      orders: finalOrders,
      total: finalOrders.length,
      summary: {
        todayOrders: todayCount,
        placedOrders: placedCount,
        preparingOrders: preparingCount,
        inTransitOrders: inTransitCount,
        completedToday: completedTodayCount,
      }
    });
  } catch (error) {
    console.error("Get All Admin Orders Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /admin/orders/:orderId
 * Get comprehensive order detail by ID (from Order or WarehouseOrder)
 */
export const getAdminOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;
    let order = await Order.findById(orderId)
      .populate('merchantId', 'shopName phoneNumber address logo fulfillmentType isOnline')
      .populate('userId', 'name phoneNumber email')
      .populate('deliveryRiderId', 'name phone currentStatus')
      .lean();

    if (!order) {
      order = await WarehouseOrder.findById(orderId)
        .populate('warehouseId', 'name code address phone')
        .populate('sourceMerchantId', 'shopName phoneNumber address logo')
        .populate('userId', 'name phoneNumber email')
        .populate('deliveryRiderId', 'name phone currentStatus')
        .lean();
      if (order) {
        order.isWarehouseOrder = true;
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Get Admin Order Detail Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

