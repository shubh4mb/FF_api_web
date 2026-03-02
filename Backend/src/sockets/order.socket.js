import { getMerchantMeta } from "../helperFns/merchantFns.js";

export const registerOrderSockets = (io, socket) => {
  console.log("Registering order sockets for:", socket.id);

  socket.on("joinOrderRoom", (orderId) => {
    const roomName = orderId;
    console.log(roomName, "roomName from join");
    socket.join(roomName);
    console.log(`✅ Socket ${socket.id} joined room ${roomName}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket ${socket.id} disconnected from order handling`);
  });

};


export const emitOrderUpdate = async (io, orderId, order) => {
  console.log(orderId, "asdasdasdas nn");

  const merchantId = order.merchantId?.toString();
  if (merchantId) {
    const meta = await getMerchantMeta(merchantId);
    if (meta && meta.isOnline) {
      io.to(`merchant:${merchantId}`).emit("orderUpdate", order);
    } else {
      console.log(`Merchant ${merchantId} is offline`);
    }
  }

  console.log("sdajfsdajf dasf");

  // Emit to orderId room for other roles (e.g., user, rider)
  io.to(orderId).emit("orderUpdate", order);
  // console.log(`Emitted order update to room ${orderId}`);
};

