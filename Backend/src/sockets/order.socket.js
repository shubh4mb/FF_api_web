import { getMerchantMeta } from "../helperFns/merchantFns.js";

export const registerOrderSockets = (io, socket) => {
  socket.on("joinOrderRoom", (orderId) => {
    socket.join(orderId);
  });

  socket.on("disconnect", () => {
    // cleanup handled by socket.io automatically
  });
};


export const emitOrderUpdate = async (io, orderId, order) => {
  // Project only status-relevant fields to reduce payload size
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
  };

  const merchantId = order.merchantId?.toString();
  if (merchantId) {
    const meta = await getMerchantMeta(merchantId);
    if (meta && meta.isOnline) {
      io.to(`merchant:${merchantId}`).emit("orderUpdate", payload);
    }
  }

  // Emit to orderId room for other roles (user, rider)
  io.to(orderId).emit("orderUpdate", payload);
};

