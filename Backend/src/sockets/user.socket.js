// src/sockets/user.socket.js
export const registerUserSockets = (io, socket) => {
    
    
  
    // Optional: handle user disconnect
    socket.on("disconnect", () => {
      const orderId = socket.data?.orderId;
      if (orderId) {
        console.log(`👤 User ${socket.id} disconnected from order_${orderId}`);
      }
    });
  };
   