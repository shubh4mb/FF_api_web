/**
 * Rider Timeout & Auto-Re-Queue
 *
 * When a rider is assigned an order, they get a 2-minute window to accept.
 * If they don't act, the assignment is revoked and the order is re-queued
 * for the next available rider.
 *
 * Usage: call `startRiderTimeout(orderId, riderId, zoneId)` after assigning.
 */

import Order from "../models/order.model.js";
import PendingOrder from "../models/pendingOrders.model.js";
import deliveryRiderModel from "../models/deliveryRider.model.js";
import { setRiderMeta, getRiderMeta } from "./deliveryRiderFns.js";
import { matchQueuedOrders } from "./orderFns.js";
import { getIO } from "../config/socket.js";
import { notifyOrderEvent } from "./notificationHelper.js";

const RIDER_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// In-memory map of active timeouts (orderId → timeoutId)
const activeTimeouts = new Map();

/**
 * Start a 2-minute timeout for a rider assignment.
 * If the rider doesn't accept (via the acceptOrder endpoint), the order
 * gets re-queued to the next rider.
 */
export function startRiderTimeout(orderId, riderId, zoneId) {
    // Clear any existing timeout for this order
    clearRiderTimeout(orderId);

    const timeoutId = setTimeout(async () => {
        try {
            activeTimeouts.delete(orderId);

            // Check if the rider actually accepted in the meantime
            const order = await Order.findById(orderId);
            if (!order) return;

            // If the order is still in "queued" or "unassigned" state, the rider didn't accept
            if (!["queued", "placed", "accepted"].includes(order.orderStatus)) {
                return; // order already moved past acceptance — no timeout needed
            }

            // Check if rider actually accepted the order (deliveryRiderId is set AND status moved)
            if (
                order.deliveryRiderId?.toString() === riderId &&
                order.deliveryRiderStatus === "assigned"
            ) {
                // Rider was assigned but didn't take action — revoke

                // 1. Free the rider
                const meta = await getRiderMeta(riderId);
                await setRiderMeta(riderId, zoneId, {
                    ...meta,
                    isBusy: false,
                    assignedOrderId: "",
                });

                await deliveryRiderModel.findByIdAndUpdate(riderId, {
                    currentOrderId: null,
                    isBusy: false,
                    isAvailable: true,
                });

                // 2. Reset the order for re-queue
                order.deliveryRiderId = null;
                order.deliveryRiderDetails = { name: null, phone: null };
                order.deliveryRiderStatus = "queued";
                await order.save();

                // 3. Re-queue the pending order
                await PendingOrder.findOneAndUpdate(
                    { orderId: orderId.toString() },
                    { status: "queued", assignedRider: null, assignedAt: null }
                );

                // 4. Notify the timed-out rider
                notifyOrderEvent("rider", "order_timeout", {
                    riderId,
                    orderId: order._id,
                });

                // 5. Emit update and trigger re-match
                const io = getIO();
                io.to(orderId.toString()).emit("orderUpdate", {
                    orderId,
                    orderStatus: order.orderStatus,
                    deliveryRiderStatus: "queued",
                    message: "Previous rider timed out, finding new rider...",
                });

                // 6. Trigger matcher to find next rider
                await matchQueuedOrders(zoneId);

                console.log(
                    `⏰ Rider ${riderId} timed out on order ${orderId} — re-queued in zone ${zoneId}`
                );
            }
        } catch (err) {
            console.error("Rider timeout handler error:", err);
        }
    }, RIDER_TIMEOUT_MS);

    activeTimeouts.set(orderId.toString(), timeoutId);
}

/**
 * Clear the timeout for an order (called when rider explicitly accepts).
 */
export function clearRiderTimeout(orderId) {
    const key = orderId.toString();
    if (activeTimeouts.has(key)) {
        clearTimeout(activeTimeouts.get(key));
        activeTimeouts.delete(key);
    }
}

/**
 * Check if an order has an active timeout.
 */
export function hasActiveTimeout(orderId) {
    return activeTimeouts.has(orderId.toString());
}
