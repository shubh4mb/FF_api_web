export const registerOrderSockets = (io) => {
// When client connects
io.on("connection", (socket) => {
  console.log("⚡ New client connected:", socket.id);

  // Client requests to join an order room
  socket.on("joinOrderRoom", (orderId) => {
    const roomName = `order_${orderId}`;
    socket.join(roomName);
    console.log(`✅ Socket ${socket.id} joined ${roomName}`);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});
};

// Example: when order status changes
export const emitOrderUpdate = (io, orderId, updateData) => {
  const roomName = `order_${orderId}`;
  io.to(roomName).emit("orderUpdate", updateData);
};
