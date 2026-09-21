import Order from "../models/order.model.js";
import WarehouseOrder from "../models/warehouseOrder.model.js";
import ProductFlat from "../models/productFlat.model.js";

/**
 * Sweeps abandoned orders stuck in "pending" status for more than 30 minutes,
 * releases their reserved stock in ProductFlat, and marks them cancelled.
 */
export async function sweepAbandonedPendingOrders() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  try {
    const [staleOrders, staleWhOrders] = await Promise.all([
      Order.find({
        orderStatus: "pending",
        paymentStatus: "pending",
        createdAt: { $lt: cutoff },
      }),
      WarehouseOrder.find({
        orderStatus: "pending",
        paymentStatus: "pending",
        createdAt: { $lt: cutoff },
      }),
    ]);

    const allStale = [...staleOrders, ...staleWhOrders];
    if (allStale.length === 0) return;

    console.log(`[Order Sweep] Found ${allStale.length} abandoned pending order(s) to release.`);

    for (const order of allStale) {
      for (const item of order.items || []) {
        if (item.variantId) {
          try {
            await ProductFlat.updateOne(
              { _id: item.variantId },
              { $inc: { reservedStock: -(item.quantity || 1) } }
            );
          } catch (err) {
            console.error(`[Order Sweep] Error releasing reserved stock for variant ${item.variantId}:`, err.message);
          }
        }
      }

      order.orderStatus = "cancelled";
      order.reason = "Payment session expired (abandoned checkout)";
      await order.save();
    }

    // Safety guard: ensure no variant has negative reservedStock
    await ProductFlat.updateMany(
      { reservedStock: { $lt: 0 } },
      { $set: { reservedStock: 0 } }
    );
  } catch (error) {
    console.error("[Order Sweep] ❌ Error in sweepAbandonedPendingOrders:", error.message);
  }
}
