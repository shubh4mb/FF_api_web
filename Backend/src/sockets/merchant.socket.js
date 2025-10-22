// src/sockets/merchant.socket.js
import Merchant from "../models/merchant.model.js";
export let onlineMerchants={};

export const registerMerchantSockets = (io, socket) => {
  socket.on("registerMerchant", async (merchantId) => {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return;
    merchant.isOnline = true;
    await merchant.save();
      if (!onlineMerchants[merchantId]) onlineMerchants[merchantId] = [];
onlineMerchants[merchantId].push(socket.id);
    socket.data.merchantId = merchantId; // store merchantId on socket itself
    console.log(`✅ Merchant ${merchantId} connected with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    const merchantId = socket.data.merchantId;

    if (merchantId && onlineMerchants[merchantId]) {
      // remove this socket only
      onlineMerchants[merchantId] = onlineMerchants[merchantId].filter(
        (id) => id !== socket.id
      );

      if (onlineMerchants[merchantId].length === 0) {
        // no more active sockets for this merchant
        delete onlineMerchants[merchantId];
        console.log(`❌ Merchant ${merchantId} fully disconnected`);
      } else {
        console.log(
          `⚠️ Merchant ${merchantId} disconnected socket ${socket.id}, remaining sockets:`,
          onlineMerchants[merchantId]
        );
      }
    }
  });
};


export const notifyMerchant = (io, merchantId, orderData) => {
  const merchantSocketIds = onlineMerchants[merchantId];
  console.log(merchantSocketIds, "notify merchant");

  if (merchantSocketIds && merchantSocketIds.length > 0) {
    merchantSocketIds.forEach((socketId) => {
      io.to(socketId).emit("newOrder", orderData);
    });
    console.log(`📩 Sent newOrder to Merchant ${merchantId}`);
  } else {
    console.log(
      `⚠️ Merchant ${merchantId} is offline, maybe send push notification`
    );
  }
};






  
