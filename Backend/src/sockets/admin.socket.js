// src/sockets/admin.socket.js
/**
 * Socket handlers for Admin real-time monitoring across all merchants.
 * Admin sockets join the 'admin:orders' room to receive instant notifications
 * when any order is placed or updated for any merchant.
 */
export const registerAdminSockets = (io, socket) => {
  // Automatically join admin orders room
  socket.join("admin:orders");
  socket.join("admin");
  console.log(`🔌 [Socket] Admin socket ${socket.id} auto-joined 'admin:orders' room`);

  socket.on("joinAdminOrders", () => {
    socket.join("admin:orders");
    socket.join("admin");
    console.log(`🔌 [Socket] Admin socket ${socket.id} explicitly joined 'admin:orders' room`);
    socket.emit("adminJoined", { room: "admin:orders", timestamp: new Date().toISOString() });
  });

  socket.on("leaveAdminOrders", () => {
    socket.leave("admin:orders");
    socket.leave("admin");
    console.log(`🔌 [Socket] Admin socket ${socket.id} left 'admin:orders' room`);
  });
};
