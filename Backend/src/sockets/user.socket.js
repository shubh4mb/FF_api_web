// src/sockets/user.socket.js
export const registerUserSockets = (io, socket) => {
  const userId = socket.handshake.query?.userId;
  if (userId) {
    const cleanUserId = String(userId).replace(/^["']|["']$/g, '').trim();
    socket.join(`user:${cleanUserId}`);
    socket.join(cleanUserId);
    console.log(`👤 User socket ${socket.id} joined user rooms: 'user:${cleanUserId}' and '${cleanUserId}'`);
  }

  socket.on("joinUserRoom", (uid) => {
    if (!uid) return;
    const cleanUid = String(uid).replace(/^["']|["']$/g, '').trim();
    socket.join(`user:${cleanUid}`);
    socket.join(cleanUid);
    console.log(`👤 User socket ${socket.id} joined user rooms via event: 'user:${cleanUid}' and '${cleanUid}'`);
  });

  socket.on("disconnect", () => {
    const orderId = socket.data?.orderId;
    if (orderId) {
      console.log(`👤 User ${socket.id} disconnected from order_${orderId}`);
    }
  });
};