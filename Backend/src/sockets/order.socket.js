export const registerOrderSockets = (io, socket) => {
  console.log("Registering order sockets for:", socket.id);

  socket.on("joinOrderRoom", (orderId) => {
    const roomName = orderId;
    console.log(roomName,"roomName from join");
    socket.join(roomName);
    console.log(`✅ Socket ${socket.id} joined room ${roomName}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket ${socket.id} disconnected from order handling`);
  });
};


export const emitOrderUpdate = (io, orderId , updateData) => {
  const roomName = orderId;
  console.log('Emitting to rooms:', io.sockets.adapter.rooms);
  console.log(roomName,"roomName in emit orderupdate");
  io.to(roomName).emit("orderUpdate", orderId);
};

