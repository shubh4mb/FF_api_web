
import {onlineMerchants} from "../sockets/merchant.socket.js";


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


export const emitOrderUpdate = (io, orderId, order) => {
  console.log(orderId,"asdasdasdas nn");
  
  const merchantSocketIds = onlineMerchants[order.merchantId?.toString()];
  console.log(merchantSocketIds,"SAdsad");
  
  if (merchantSocketIds && merchantSocketIds.length > 0) {
    // console.log(order,"order");
    
    merchantSocketIds.forEach((socketId) => {
      console.log(socketId,"socketId");
      
      io.to(socketId).emit("orderUpdate", order);
      // console.log(`📦 Emitted orderUpdate to merchant socket ${socketId}`);
    });
  } else {
    console.log(`No active sockets for merchant ${order.merchantId}`);
  }
console.log("sdajfsdajf dasf");

  // Emit to orderId room for other roles (e.g., user, rider)
  io.to(orderId).emit("orderUpdate", order);
  // console.log(`Emitted order update to room ${orderId}`);
};

