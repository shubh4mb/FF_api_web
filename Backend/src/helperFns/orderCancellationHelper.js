import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import WarehouseOrder from '../models/warehouseOrder.model.js';
import ProductFlat from '../models/productFlat.model.js';
import DeliveryRider from '../models/deliveryRider.model.js';
import PendingOrder from '../models/pendingOrders.model.js';
import { creditWallet } from './walletHelper.js';
import { notifyOrderEvent } from './notificationHelper.js';
import { getIO } from '../config/socket.js';
import { emitOrderUpdate } from '../sockets/order.socket.js';
import { emitWarehouseOrderUpdate, notifyWarehouse } from '../sockets/warehouseOrder.socket.js';
import { notifyMerchant } from '../sockets/merchant.socket.js';
import { setRiderMeta, getRiderMeta, geoAdd } from './deliveryRiderFns.js';
import { clearRiderTimeout } from './riderTimeoutHelper.js';
import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Universal order cancellation and resource cleanup pipeline.
 *
 * Handles:
 *  1. Polymorphic Order / WarehouseOrder lookup
 *  2. Terminal state verification
 *  3. Status mutation (cancelled / rejected)
 *  4. Inventory un-reservation in ProductFlat
 *  5. Upfront fee refund to customer wallet
 *  6. Rider release (DB state, Redis meta, Redis geo, socket alert, push notification)
 *  7. Queue & timeout teardown (PendingOrder, rider assignment timeouts)
 *  8. Multi-channel real-time socket updates (User, Merchant, Warehouse, Rider, Admin)
 *  9. Customer push notification
 * 10. Audit logging
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.orderId
 * @param {'user'|'merchant'|'admin'|'system'} params.cancelledBy
 * @param {string} [params.reason]
 * @param {'cancelled'|'rejected'} [params.action='cancelled']
 * @param {Object} [params.req] - Express request for audit logging
 * @param {mongoose.ClientSession} [params.session] - Active transaction session (optional)
 * @returns {Promise<{success: boolean, order?: Object, refundAmount?: number, message?: string, statusCode?: number, error?: string}>}
 */
export const cancelAndCleanupOrder = async ({
  orderId,
  cancelledBy = 'system',
  reason = 'Order cancelled',
  action = 'cancelled',
  req = null,
  session = null,
}) => {
  try {
    // 1. Polymorphic Lookup
    let order = await Order.findById(orderId).session(session);
    let isWarehouseOrder = false;

    if (!order) {
      order = await WarehouseOrder.findById(orderId).session(session);
      if (order) isWarehouseOrder = true;
    }

    if (!order) {
      return { success: false, error: 'Order not found', statusCode: 404 };
    }

    // 2. Terminal State Validation
    const irreversibleStatuses = ['completed', 'delivered', 'returned'];
    if (irreversibleStatuses.includes(order.orderStatus)) {
      return {
        success: false,
        error: `Cannot cancel an order in ${order.orderStatus} state`,
        statusCode: 400,
      };
    }

    if (order.orderStatus === action) {
      return {
        success: true,
        message: `Order is already ${action}`,
        order,
        refundAmount: 0,
        isWarehouseOrder,
      };
    }

    // 3. Status Mutation
    order.orderStatus = action;
    order.customerDeliveryStatus = 'cancelled';
    order.deliveryRiderStatus = 'cancelled';
    order.reason = reason;

    if (order.cancellationRequest === 'pending') {
      order.cancellationRequest = action === 'rejected' ? 'rejected' : 'approved';
    }

    // 4. Release Reserved Inventory in ProductFlat
    for (const item of order.items || []) {
      if (item.variantId) {
        try {
          await ProductFlat.updateOne(
            { _id: item.variantId },
            { $inc: { reservedStock: -(item.quantity || 1) } }
          ).session(session);
        } catch (stockErr) {
          console.error(`Error releasing reserved stock for variant ${item.variantId}:`, stockErr);
        }
      }
    }

    // 5. Refund Upfront Fees to Customer Wallet
    const isFreeOrder = order.razorpayOrderId && order.razorpayOrderId.startsWith('free_');
    const isRefundable =
      !isFreeOrder &&
      (order.paymentStatus === 'delivery_fee_paid' ||
       order.paymentStatus === 'paid');

    const refundAmount =
      (order.deliveryCharge || 0) +
      (order.returnCharge || 0) +
      (order.finalBilling?.deliveryTip || 0) +
      (order.finalBilling?.serviceGST || 0);

    if (isRefundable && refundAmount > 0) {
      const shortId = order._id.toString().slice(-5).toUpperCase();
      const refundDescription =
        action === 'rejected'
          ? `Refund: Order #${shortId} was declined by store.`
          : `Refund: Order #${shortId} was cancelled (${cancelledBy}).`;

      try {
        await creditWallet({
          ownerType: 'user',
          ownerId: order.userId,
          amount: refundAmount,
          description: refundDescription,
          orderId: order._id,
          session,
        });
        order.paymentStatus = 'refunded';
      } catch (refundErr) {
        console.error('Wallet credit error during order cancellation:', refundErr);
      }
    }

    // 6. Free the Assigned / Queued Delivery Rider
    let riderIdToFree = order.deliveryRiderId;

    // Check PendingOrder queue
    try {
      const pendingOrderDoc = await PendingOrder.findOne({ orderId: order._id }).session(session);
      if (pendingOrderDoc) {
        if (!riderIdToFree && pendingOrderDoc.assignedRider) {
          riderIdToFree = pendingOrderDoc.assignedRider;
        }
        await PendingOrder.deleteOne({ _id: pendingOrderDoc._id }).session(session);
      }
    } catch (pendingErr) {
      console.error('Error clearing pending order record:', pendingErr);
    }

    if (riderIdToFree) {
      try {
        const rider = await DeliveryRider.findByIdAndUpdate(
          riderIdToFree,
          {
            currentOrderId: null,
            isBusy: false,
            isAvailable: true,
          },
          { new: true }
        ).session(session);

        const meta = await getRiderMeta(riderIdToFree.toString());
        const zoneId = meta?.zoneId || 'global';

        await setRiderMeta(riderIdToFree.toString(), zoneId, {
          isBusy: 'false',
          assignedOrderId: '',
        });

        // Re-add rider to Redis geo pool if online
        if (
          rider?.location?.coordinates?.length === 2 &&
          meta?.isOnline !== false &&
          meta?.isOnline !== 'false'
        ) {
          const [lng, lat] = rider.location.coordinates;
          await geoAdd(zoneId, lng, lat, riderIdToFree.toString());
        }

        // Notify rider via Socket & Push
        const io = getIO();
        if (io) {
          io.to(`rider:${riderIdToFree}`).emit('orderCancelled', {
            orderId: order._id.toString(),
            reason,
          });
        }

        notifyOrderEvent('rider', 'order_cancelled', {
          riderId: riderIdToFree,
          orderId: order._id,
          reason,
        });
      } catch (riderCleanupErr) {
        console.error('Rider cleanup error during order cancellation:', riderCleanupErr);
      }
    }

    // Teardown assignment timeout
    try {
      clearRiderTimeout(order._id);
    } catch (timeoutErr) {
      console.error('Error clearing rider timeout:', timeoutErr);
    }

    // 7. Persist Order
    await order.save({ session });

    // 8. Real-time Multi-Room Socket Broadcasting
    try {
      const io = getIO();
      if (io) {
        const orderIdStr = order._id.toString();

        emitOrderUpdate(io, orderIdStr, order);
        io.to(orderIdStr).emit('orderCancelled', { orderId: orderIdStr, reason });

        if (isWarehouseOrder) {
          await emitWarehouseOrderUpdate(io, order.warehouseId, orderIdStr, order);
          notifyWarehouse(
            io,
            order.warehouseId,
            `Order #${orderIdStr.slice(-5).toUpperCase()} was ${action}.`
          );
        } else if (order.merchantId) {
          const merchantIdStr = (order.merchantId._id || order.merchantId).toString();
          notifyMerchant(
            io,
            merchantIdStr,
            `Order #${orderIdStr.slice(-5).toUpperCase()} was ${action}.`
          );
        }
      }
    } catch (socketErr) {
      console.error('Socket broadcast error during order cancellation:', socketErr);
    }

    // 9. Customer Notification
    try {
      notifyOrderEvent(
        'customer',
        action === 'rejected' ? 'order_rejected' : 'order_cancelled',
        {
          userId: order.userId,
          orderId: order._id,
          amount: isRefundable ? refundAmount : 0,
          reason,
        }
      );
    } catch (custNotifErr) {
      console.error('Customer notification error during cancellation:', custNotifErr);
    }

    // 10. Audit Logging
    try {
      await logAuditEvent({
        action: action === 'rejected' ? 'ORDER_REJECTED' : 'ORDER_CANCELLED',
        message: `Order #${order._id.toString().slice(-5).toUpperCase()} was ${action} by ${cancelledBy}. ${
          refundAmount > 0 ? `Refunded ₹${refundAmount} to wallet.` : ''
        }`,
        status: 'success',
        orderId: order._id,
        userId: order.userId,
        merchantId: order.merchantId || order.warehouseId,
        details: { refundAmount, reason, cancelledBy, riderId: riderIdToFree, isWarehouseOrder },
        req,
      });
    } catch (auditErr) {
      console.error('Audit logging error during cancellation:', auditErr);
    }

    return {
      success: true,
      message: `Order ${action} successfully. ${refundAmount > 0 ? `₹${refundAmount} refunded to customer wallet.` : ''}`.trim(),
      order,
      refundAmount: isRefundable ? refundAmount : 0,
      isWarehouseOrder,
    };
  } catch (error) {
    console.error('Fatal error in cancelAndCleanupOrder:', error);
    return { success: false, error: error.message || 'Internal server error', statusCode: 500 };
  }
};
