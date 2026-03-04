/**
 * notificationHelper.js
 *
 * Creates in-DB notifications and emits them via Socket.IO in real-time.
 *
 * Customer notifications are SELECTIVE — only key milestones.
 * Rider notifications are VERBOSE — every step matters for their workflow.
 */

import Notification from "../models/notification.model.js";
import { getIO } from "../config/socket.js";

/* ════════════════════════════════════════════════
   CUSTOMER NOTIFICATIONS (selective — 3-4 per order max)
   ════════════════════════════════════════════════ */

export async function notifyCustomer({ userId, orderId, type, title, body, data = {} }) {
    try {
        const notification = await Notification.create({
            userId,
            orderId,
            type,
            title,
            body,
            data,
        });

        // Emit via socket to the user's personal room
        const io = getIO();
        io.to(`user:${userId}`).emit("notification", {
            _id: notification._id,
            type,
            title,
            body,
            orderId,
            data,
            createdAt: notification.createdAt,
        });

        return notification;
    } catch (err) {
        console.error("notifyCustomer error:", err.message);
    }
}

/* ════════════════════════════════════════════════
   RIDER NOTIFICATIONS (verbose — show everything)
   ════════════════════════════════════════════════ */

export async function notifyRider({ riderId, orderId, type, title, body, data = {} }) {
    try {
        const notification = await Notification.create({
            riderId,
            orderId,
            type,
            title,
            body,
            data,
        });

        const io = getIO();
        io.to(`rider:${riderId}`).emit("notification", {
            _id: notification._id,
            type,
            title,
            body,
            orderId,
            data,
            createdAt: notification.createdAt,
        });

        return notification;
    } catch (err) {
        console.error("notifyRider error:", err.message);
    }
}

/* ════════════════════════════════════════════════
   BATCH: fire-and-forget convenience for order events
   ════════════════════════════════════════════════ */

/**
 * Call from any controller after an order status change.
 * Decides WHAT to notify based on the event type.
 *
 * @param {"customer"|"rider"} target
 * @param {string} event - one of the notification type enum values
 * @param {object} ctx - { userId?, riderId?, orderId, orderShortId? }
 */
export async function notifyOrderEvent(target, event, ctx) {
    const shortId = ctx.orderShortId || ctx.orderId?.toString().slice(-5).toUpperCase();

    const templates = {
        // ── Customer (selective) ──
        order_placed: {
            title: "Order Placed 🎉",
            body: `Your order #${shortId} is placed. Waiting for merchant confirmation.`,
        },
        order_accepted: {
            title: "Order Confirmed ✅",
            body: `Your order #${shortId} is accepted! We're finding a rider.`,
        },
        rider_arriving: {
            title: "Rider On The Way 🚴",
            body: `Your rider is heading to you with order #${shortId}.`,
        },
        delivery_complete: {
            title: "Order Complete 🎊",
            body: `Your order #${shortId} is fully completed. Thanks for shopping!`,
        },
        payment_confirmed: {
            title: "Payment Successful 💳",
            body: `Payment for order #${shortId} confirmed.`,
        },
        order_rejected: {
            title: "Order Declined 😔",
            body: `The merchant couldn't fulfill order #${shortId}. Refund has been credited to your wallet.`,
        },
        refund_credited: {
            title: "Refund Credited 💰",
            body: `₹${ctx.amount || 0} has been added to your FlashFits wallet.`,
        },

        // ── Rider (verbose) ──
        new_order_request: {
            title: "New Delivery Request 📦",
            body: `New order #${shortId} available. Accept within 2 minutes!`,
        },
        order_timeout: {
            title: "Request Expired ⏰",
            body: `You missed order #${shortId}. It's been reassigned.`,
        },
        pickup_ready: {
            title: "Order Packed 📦",
            body: `Order #${shortId} is packed and ready for pickup.`,
        },
        otp_verified: {
            title: "Pickup Confirmed ✅",
            body: `OTP verified. Head to the customer for order #${shortId}.`,
        },
        trial_ended: {
            title: "Trial Phase Ended ⏰",
            body: `Customer has finished trying items for order #${shortId}.`,
        },
        return_started: {
            title: "Return Trip 🔄",
            body: `Head back to merchant with returned items for order #${shortId}.`,
        },
        return_complete: {
            title: "Return Verified ✅",
            body: `Merchant confirmed return for order #${shortId}. Well done!`,
        },
        earnings_credited: {
            title: "Earnings Added 💰",
            body: `₹${ctx.amount || 0} earned for order #${shortId}.`,
        },
    };

    const tmpl = templates[event];
    if (!tmpl) {
        console.warn(`notifyOrderEvent: unknown event "${event}"`);
        return;
    }

    if (target === "customer" && ctx.userId) {
        return notifyCustomer({
            userId: ctx.userId,
            orderId: ctx.orderId,
            type: event,
            title: tmpl.title,
            body: tmpl.body,
            data: ctx.data || {},
        });
    }

    if (target === "rider" && ctx.riderId) {
        return notifyRider({
            riderId: ctx.riderId,
            orderId: ctx.orderId,
            type: event,
            title: tmpl.title,
            body: tmpl.body,
            data: ctx.data || {},
        });
    }
}
