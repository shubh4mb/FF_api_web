import Order from "../../models/order.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import PendingOrder from "../../models/pendingOrders.model.js";
import { getIO } from "../../config/socket.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { creditWallet } from "../../helperFns/walletHelper.js";
import { notifyOrderEvent } from "../../helperFns/notificationHelper.js";
import { setRiderMeta, getRiderMeta } from "../../helperFns/deliveryRiderFns.js";
import { logAuditEvent } from "../../utils/auditLogger.js";

/**
 * Get all orders with a pending cancellation request from a merchant
 */
export const getCancellationRequests = async (req, res) => {
  try {
    const orders = await Order.find({ cancellationRequest: 'pending' })
      .populate('merchantId', 'shopName')
      .populate('userId', 'name phone')
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Get Cancellation Requests Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Approve or reject a merchant cancellation request
 */
export const adminCancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  try {
    const order = await Order.findById(orderId);
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
        merchantId: order.merchantId,
        req,
      });

      const io = getIO();
      emitOrderUpdate(io, orderId, order);

      return res.status(200).json({ success: true, message: "Cancellation request rejected", order });
    }

    if (action === 'approve') {
      // 1. Mark cancellation status
      order.cancellationRequest = 'approved';
      order.orderStatus = 'cancelled';
      order.customerDeliveryStatus = 'cancelled';
      order.deliveryRiderStatus = 'cancelled';

      // 2. Refund upfront fees to customer if paid
      const isRefundable = order.paymentStatus === 'delivery_fee_paid' || order.paymentStatus === 'paid';
      const refundAmount = (order.deliveryCharge || 0) + (order.returnCharge || 0) + (order.finalBilling?.deliveryTip || 0) + (order.finalBilling?.serviceGST || 0);

      if (isRefundable && refundAmount > 0) {
        await creditWallet({
          ownerType: "user",
          ownerId: order.userId,
          amount: refundAmount,
          description: `Refund: Order #${order._id.toString().slice(-5).toUpperCase()} cancelled by Admin`,
          orderId: order._id,
        });
        order.paymentStatus = 'refunded';
      }

      // 3. Free the rider in DB & Redis if assigned (either accepted or offered/assigned in queue)
      let riderIdToFree = order.deliveryRiderId;
      
      const pendingOrderDoc = await PendingOrder.findOne({ orderId: order._id });
      if (pendingOrderDoc) {
        if (!riderIdToFree && pendingOrderDoc.assignedRider) {
          riderIdToFree = pendingOrderDoc.assignedRider;
        }
        await PendingOrder.deleteOne({ _id: pendingOrderDoc._id });
      }

      if (riderIdToFree) {
        await DeliveryRider.findByIdAndUpdate(riderIdToFree, {
          currentOrderId: null,
          isBusy: false,
          isAvailable: true,
        });

        try {
          const meta = await getRiderMeta(riderIdToFree.toString());
          await setRiderMeta(riderIdToFree.toString(), meta?.zoneId || 'global', {
            isBusy: "false",
            assignedOrderId: "",
          });
        } catch (redisErr) {
          console.error("Redis meta cleanup error (non-fatal):", redisErr);
        }
      }

      // 4. Clear any active assignment timeout
      try {
        const { clearRiderTimeout } = await import("../../helperFns/riderTimeoutHelper.js");
        clearRiderTimeout(order._id);
      } catch (err) {
        console.error("Error clearing rider timeout (non-fatal):", err);
      }

      await order.save();

      await logAuditEvent({
        action: "ORDER_CANCELLED",
        message: `Admin approved cancellation request for order #${order._id.toString().slice(-5).toUpperCase()}. Refunded upfront fee of ₹${refundAmount} to customer wallet.`,
        status: "success",
        orderId: order._id,
        userId: order.userId,
        merchantId: order.merchantId,
        details: { refundAmount },
        req,
      });

      const io = getIO();
      emitOrderUpdate(io, orderId, order);

      // 5. Notify customer
      notifyOrderEvent("customer", "order_cancelled", {
        userId: order.userId,
        orderId: order._id,
        amount: isRefundable ? refundAmount : 0,
      });

      return res.status(200).json({ success: true, message: "Order cancelled successfully and rider/redis freed", order });
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
    const orders = await Order.find({ 'riderUnresponsiveReport.status': 'pending' })
      .populate('merchantId', 'shopName')
      .populate('userId', 'name phone')
      .populate('deliveryRiderId', 'name phone')
      .sort({ 'riderUnresponsiveReport.reportedAt': -1 })
      .lean();

    return res.status(200).json({ success: true, orders });
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
    const order = await Order.findById(orderId);
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
      // 1. Mark report status
      order.riderUnresponsiveReport.status = 'resolved';
      order.orderStatus = 'cancelled';
      order.customerDeliveryStatus = 'cancelled';
      order.deliveryRiderStatus = 'cancelled';

      // 2. Refund upfront fees to customer if paid
      const isRefundable = order.paymentStatus === 'delivery_fee_paid' || order.paymentStatus === 'paid';
      const refundAmount = (order.deliveryCharge || 0) + (order.returnCharge || 0) + (order.finalBilling?.deliveryTip || 0) + (order.finalBilling?.serviceGST || 0);

      if (isRefundable && refundAmount > 0) {
        await creditWallet({
          ownerType: "user",
          ownerId: order.userId,
          amount: refundAmount,
          description: `Refund: Order #${order._id.toString().slice(-5).toUpperCase()} cancelled due to unresponsive rider`,
          orderId: order._id,
        });
        order.paymentStatus = 'refunded';
      }

      // 3. Free the rider
      const riderIdToFree = order.deliveryRiderId;
      if (riderIdToFree) {
        await DeliveryRider.findByIdAndUpdate(riderIdToFree, {
          currentOrderId: null,
          isBusy: false,
          isAvailable: true,
        });

        try {
          const meta = await getRiderMeta(riderIdToFree.toString());
          await setRiderMeta(riderIdToFree.toString(), meta?.zoneId || 'global', {
            isBusy: "false",
            assignedOrderId: "",
          });
        } catch (redisErr) {
          console.error("Redis meta cleanup error:", redisErr);
        }
      }

      await order.save();

      await logAuditEvent({
        action: "ORDER_CANCELLED",
        message: `Admin cancelled order #${order._id.toString().slice(-5).toUpperCase()} due to unresponsive rider.`,
        status: "success",
        orderId: order._id,
        userId: order.userId,
        merchantId: order.merchantId,
        details: { refundAmount, riderId: riderIdToFree },
        req,
      });

      const io = getIO();
      emitOrderUpdate(io, orderId, order);

      // 5. Notify customer & merchant
      notifyOrderEvent("customer", "order_cancelled", {
        userId: order.userId,
        orderId: order._id,
        amount: isRefundable ? refundAmount : 0,
        message: "Order was cancelled because the assigned rider was unresponsive."
      });

      // (Assuming you have a way to notify merchants too if needed)

      return res.status(200).json({ success: true, message: "Order cancelled successfully", order });
    }

    return res.status(400).json({ success: false, message: "Invalid action. Must be 'dismiss' or 'cancel_order'" });

  } catch (error) {
    console.error("Resolve Unresponsive Rider Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
