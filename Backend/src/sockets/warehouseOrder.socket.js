// src/sockets/warehouseOrder.socket.js
import Warehouse from "../models/warehouse.model.js";
import { sendPushNotifications } from "../helperFns/notificationHelper.js";

/**
 * Socket handlers for warehouse operators.
 * Mirrors merchant.socket.js but uses `warehouse:{warehouseId}` rooms.
 */
export const registerWarehouseOrderSockets = (io, socket) => {
  /**
   * Warehouse operator connects and joins their warehouse room.
   * Frontend emits: socket.emit("registerWarehouse", warehouseId)
   */
  socket.on("registerWarehouse", async (warehouseId) => {
    if (!warehouseId) return;

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return;

    socket.join(`warehouse:${warehouseId}`);
    socket.data.warehouseId = warehouseId;

    console.log(`✅ Warehouse ${warehouseId} operator connected with socket ${socket.id} to room warehouse:${warehouseId}`);
  });

  socket.on("disconnect", async () => {
    const warehouseId = socket.data.warehouseId;
    if (warehouseId) {
      const remainingSockets = await io.in(`warehouse:${warehouseId}`).fetchSockets();
      if (remainingSockets.length === 0) {
        console.log(`❌ Warehouse ${warehouseId} fully disconnected`);
      } else {
        console.log(
          `⚠️ Warehouse ${warehouseId} disconnected socket ${socket.id}, remaining:`,
          remainingSockets.map(s => s.id)
        );
      }
    }
  });
};

/**
 * Emit a new warehouse order event to the warehouse operator room.
 * Called when a user places a warehouse T&B order.
 */
export const notifyWarehouse = async (io, warehouseId, orderData) => {
  const whId = String(warehouseId);
  const room = `warehouse:${whId}`;

  io.to(room).emit("newWarehouseOrder", orderData);
  console.log(`📩 [Socket] Emitted newWarehouseOrder to room ${room}`);
};

/**
 * Emit a warehouse order update to:
 * 1. The warehouse operator room (warehouse:{warehouseId})
 * 2. The specific order room (for user/rider listeners)
 */
export const emitWarehouseOrderUpdate = async (io, warehouseId, orderId, order) => {
  const payload = {
    _id: order._id,
    orderStatus: order.orderStatus,
    deliveryRiderStatus: order.deliveryRiderStatus,
    customerDeliveryStatus: order.customerDeliveryStatus,
    paymentStatus: order.paymentStatus,
    otp: order.otp,
    items: order.items,
    totalAmount: order.totalAmount,
    finalBilling: order.finalBilling,
    deliveryRiderDetails: order.deliveryRiderDetails,
    warehouseDetails: order.warehouseDetails,
    deliveryCharge: order.deliveryCharge,
    warehouseId: order.warehouseId,
    userId: order.userId,
    deliveryRiderId: order.deliveryRiderId,
    deliveryLocation: order.deliveryLocation,
    pickupLocation: order.pickupLocation,
    trialPhaseStart: order.trialPhaseStart,
    trialPhaseEnd: order.trialPhaseEnd,
    trialPhaseDuration: order.trialPhaseDuration,
    fulfillmentType: order.fulfillmentType,
  };

  // Emit to the warehouse operator
  io.to(`warehouse:${String(warehouseId)}`).emit("warehouseOrderUpdate", payload);

  // Emit to the order-specific room (user, rider)
  io.to(String(orderId)).emit("warehouseOrderUpdate", payload);
};
