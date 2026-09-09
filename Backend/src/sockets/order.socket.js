export const registerOrderSockets = (io, socket) => {
  socket.on("joinOrderRoom", (orderId) => {
    if (!orderId) return;
    const cleanId = String(orderId).replace(/^["']|["']$/g, '').trim();
    socket.join(cleanId);
    socket.join(String(orderId));
    console.log(`[Socket] Socket ${socket.id} joined order rooms: '${cleanId}' and '${orderId}'`);
  });

  socket.on("leaveOrderRoom", (orderId) => {
    if (!orderId) return;
    const cleanId = String(orderId).replace(/^["']|["']$/g, '').trim();
    socket.leave(cleanId);
    socket.leave(String(orderId));
  });

  socket.on("disconnect", () => {
    // cleanup handled by socket.io automatically
  });
};

export const emitOrderUpdate = async (io, orderId, order) => {
  if (!io || !order) return;

  const rawId = orderId ? String(orderId) : String(order._id);
  const cleanId = rawId.replace(/^["']|["']$/g, '').trim();
  const dbId = order._id ? String(order._id) : cleanId;

  // Project relevant fields for real-time synchronization
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
    overtimePenalty: order.overtimePenalty,
    deliveryFeeRecovery: order.deliveryFeeRecovery,
    deliveryRiderDetails: order.deliveryRiderDetails,
    merchantDetails: order.merchantDetails,
    deliveryCharge: order.deliveryCharge,
    merchantId: order.merchantId,
    userId: order.userId,
    deliveryRiderId: order.deliveryRiderId,
    deliveryLocation: order.deliveryLocation,
    pickupLocation: order.pickupLocation,
    trialPhaseStart: order.trialPhaseStart,
    trialPhaseEnd: order.trialPhaseEnd,
    trialPhaseDuration: order.trialPhaseDuration,
    photoVerified: order.photoVerified || false,
    warehouseId: order.warehouseId,
    warehouseDetails: order.warehouseDetails,
    fulfillmentType: order.fulfillmentType,
    settlementStatus: order.settlementStatus,
    packingPhotos: order.packingPhotos,
    reason: order.reason,
    cancellationRequest: order.cancellationRequest,
    cancellationRequestReason: order.cancellationRequestReason,
  };

  // Always emit to merchant room
  const merchantId = order.merchantId?._id ? order.merchantId._id.toString() : order.merchantId?.toString();
  if (merchantId) {
    io.to(`merchant:${merchantId}`).emit("orderUpdate", payload);
  }

  // Always emit to warehouse room if warehouse order
  const warehouseId = order.warehouseId?._id ? order.warehouseId._id.toString() : order.warehouseId?.toString();
  if (warehouseId) {
    io.to(`warehouse:${warehouseId}`).emit("orderUpdate", payload);
    io.to(`warehouse:${warehouseId}`).emit("warehouseOrderUpdate", payload);
  }

  // Always emit to user room so customer app receives real-time status transitions
  const userId = order.userId?._id ? order.userId._id.toString() : order.userId?.toString();
  if (userId) {
    const cleanUserId = String(userId).replace(/^["']|["']$/g, '').trim();
    io.to(`user:${cleanUserId}`).emit("orderUpdate", payload);
    if (cleanUserId) {
      io.to(cleanUserId).emit("orderUpdate", payload);
    }
  }

  // Emit to all matching order rooms (clean ID, raw ID, DB ID)
  io.to(cleanId).emit("orderUpdate", payload);
  if (rawId !== cleanId) {
    io.to(rawId).emit("orderUpdate", payload);
  }
  if (dbId !== cleanId && dbId !== rawId) {
    io.to(dbId).emit("orderUpdate", payload);
  }

  console.log(`[Socket] Emitted orderUpdate for order ${cleanId} (status: ${order.orderStatus}, riderStatus: ${order.deliveryRiderStatus})`);
};

