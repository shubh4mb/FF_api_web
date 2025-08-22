// src/sockets/merchant.socket.js
let onlineMerchants = {};

export const registerMerchantSockets = (io) => {
  
  io.on("connection", (socket) => {
    console.log("⚡ Socket connected:", socket.id); // just a generic socket connect
  
    socket.on("registerMerchant", (merchantId) => {
      onlineMerchants[merchantId] = socket.id;
      socket.data.merchantId = merchantId; // store merchantId on socket itself
      console.log(`✅ Merchant ${merchantId} connected with socket ${socket.id}`);
    });
  
    socket.on("disconnect", () => {
      const merchantId = socket.data.merchantId;
      if (merchantId) {
        delete onlineMerchants[merchantId];
        console.log(`❌ Merchant ${merchantId} disconnected`);
      } else {
        console.log(`❌ User disconnected: ${socket.id}`);
      }
    });
  });
};

export const notifyMerchant = (io, merchantId, orderData) => {
    const merchantSocketId = onlineMerchants[merchantId];
    if (merchantSocketId) {
      io.to(merchantSocketId).emit("newOrder", orderData);
      console.log(`📩 Sent newOrder to Merchant ${merchantId}`);
    } else {
      console.log(
        `⚠️ Merchant ${merchantId} is offline, maybe send push notification`
      );
    }
};





  
