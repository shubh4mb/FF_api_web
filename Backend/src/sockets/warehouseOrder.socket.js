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

    if (socket.data.warehouseId && socket.data.warehouseId !== warehouseId) {
      socket.leave(`warehouse:${socket.data.warehouseId}`);
    }

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) return;

    socket.join(`warehouse:${warehouseId}`);
    socket.data.warehouseId = warehouseId;

    console.log(`✅ Warehouse ${warehouseId} operator/admin connected with socket ${socket.id} to room warehouse:${warehouseId}`);
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
 * Emit a new warehouse order event to the warehouse room.
 * Called when a user places a warehouse order.
 */
export const notifyWarehouse = async (io, warehouseId, orderData) => {
  if (!io || !warehouseId) return;
  const whId = String(warehouseId);
  const room = `warehouse:${whId}`;

  // Emit both event names for maximum client compatibility
  io.to(room).emit("newOrder", orderData);
  io.to(room).emit("newWarehouseOrder", orderData);
  console.log(`📩 [Socket] Emitted newOrder & newWarehouseOrder to room ${room}`);
};

/**
 * Emit a warehouse order update to:
 * 1. The warehouse operator room (warehouse:{warehouseId})
 * 2. The specific order room (for user/rider listeners)
 */
export const emitWarehouseOrderUpdate = async (io, warehouseId, orderId, order) => {
  if (!io || !order) return;
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
    settlementStatus: order.settlementStatus,
    packingPhotos: order.packingPhotos,
    reason: order.reason,
    cancellationRequest: order.cancellationRequest,
    cancellationRequestReason: order.cancellationRequestReason,
  };

  const whRoom = `warehouse:${String(warehouseId)}`;
  // Emit both event names to warehouse room
  io.to(whRoom).emit("orderUpdate", payload);
  io.to(whRoom).emit("warehouseOrderUpdate", payload);

  // Emit to the order-specific room (user, rider)
  io.to(String(orderId)).emit("orderUpdate", payload);
  io.to(String(orderId)).emit("warehouseOrderUpdate", payload);

  // Emit to user room so customer app updates in real-time
  const userId = order.userId?._id ? order.userId._id.toString() : order.userId?.toString();
  if (userId) {
    const cleanUserId = String(userId).replace(/^["']|["']$/g, '').trim();
    io.to(`user:${cleanUserId}`).emit("orderUpdate", payload);
    io.to(`user:${cleanUserId}`).emit("warehouseOrderUpdate", payload);
  }
};
