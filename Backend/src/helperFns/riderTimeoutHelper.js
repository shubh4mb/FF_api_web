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
import WarehouseOrder from "../models/warehouseOrder.model.js";
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
    const cleanId = String(orderId).replace(/^["']|["']$/g, '').trim();

    // Clear any existing timeout for this order
    clearRiderTimeout(cleanId);

    const timeoutId = setTimeout(async () => {
        try {
            activeTimeouts.delete(cleanId);

            // Check if the rider actually accepted in the meantime (check Order & WarehouseOrder)
            let order = await Order.findById(cleanId);
            if (!order) {
                order = await WarehouseOrder.findById(cleanId);
            }
            if (!order) return;

            // If the order is assigned to this rider, they accepted — do NOT timeout
            if (
                order.deliveryRiderId &&
                order.deliveryRiderId.toString() === riderId.toString() &&
                !["queued", "unassigned"].includes(order.deliveryRiderStatus)
            ) {
                console.log(`⏰ Rider ${riderId} already accepted order ${cleanId} (status: ${order.deliveryRiderStatus}) — ignoring timeout`);
                return;
            }

            // If the rider has progressed past acceptance, do not timeout
            const hasProgressed = [
                "assigned",
                "en_route_pickup",
                "at_pickup",
                "picked_up",
                "en_route_delivery",
                "at_delivery",
                "try_phase",
                "returning",
                "completed"
            ].includes(order.deliveryRiderStatus);

            if (hasProgressed) {
                return; // Rider is actively fulfilling the order
            }

            // If the order is still in "queued" or "unassigned" state, the rider didn't accept
            if (!["queued", "placed", "accepted", "packed"].includes(order.orderStatus)) {
                return; // order already moved past acceptance — no timeout needed
            }

            // Rider was offered/assigned this order but did not progress — revoke assignment

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
                    _id: orderId.toString(),
                    orderId: orderId.toString(),
                    orderStatus: order.orderStatus,
                    deliveryRiderStatus: "queued",
                    message: "Previous rider timed out, finding new rider...",
                });

                // 6. Trigger matcher to find next rider
                await matchQueuedOrders(zoneId);

                console.log(
                    `⏰ Rider ${riderId} timed out on order ${orderId} — re-queued in zone ${zoneId}`
                );
        } catch (err) {
            console.error("Rider timeout handler error:", err);
        }
    }, RIDER_TIMEOUT_MS);

    activeTimeouts.set(cleanId, timeoutId);
}

/**
 * Clear the timeout for an order (called when rider explicitly accepts).
 */
export function clearRiderTimeout(orderId) {
    if (!orderId) return;
    const key = String(orderId).replace(/^["']|["']$/g, '').trim();
    if (activeTimeouts.has(key)) {
        clearTimeout(activeTimeouts.get(key));
        activeTimeouts.delete(key);
        console.log(`⏰ Cleared rider timeout for order ${key}`);
    }
}

/**
 * Check if an order has an active timeout.
 */
export function hasActiveTimeout(orderId) {
    if (!orderId) return false;
    const key = String(orderId).replace(/^["']|["']$/g, '').trim();
    return activeTimeouts.has(key);
}
