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

      // 3. Free the rider in DB & Redis if assigned
      if (order.deliveryRiderId) {
        await DeliveryRider.findByIdAndUpdate(order.deliveryRiderId, {
          currentOrderId: null,
          isBusy: false,
          isAvailable: true,
        });

        try {
          const meta = await getRiderMeta(order.deliveryRiderId.toString());
          await setRiderMeta(order.deliveryRiderId.toString(), meta?.zoneId || 'global', {
            isBusy: "false",
            assignedOrderId: "",
          });
        } catch (redisErr) {
          console.error("Redis meta cleanup error (non-fatal):", redisErr);
        }
      }

      // 4. Remove from PendingOrder queue if queued
      await PendingOrder.deleteOne({ orderId: order._id });

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
