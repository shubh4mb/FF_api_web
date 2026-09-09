import Order from "../../models/order.model.js";
import WarehouseOrder from "../../models/warehouseOrder.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import PendingOrder from "../../models/pendingOrders.model.js";
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
