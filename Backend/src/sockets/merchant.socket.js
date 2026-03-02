// src/sockets/merchant.socket.js
import Merchant from "../models/merchant.model.js";
import { setMerchantMeta, getMerchantMeta } from "../helperFns/merchantFns.js";

export const registerMerchantSockets = (io, socket) => {
  socket.on("registerMerchant", async (merchantId) => {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return;
    merchant.isOnline = true;
    await merchant.save();

    // Join a Socket.io room specific to this merchant
    socket.join(`merchant:${merchantId}`);
    socket.data.merchantId = merchantId; // store merchantId on socket itself

    // Update Redis State
    await setMerchantMeta(merchantId, { isOnline: "true", lastSeenAt: Date.now() });

    console.log(`✅ Merchant ${merchantId} connected with socket ${socket.id} to room merchant:${merchantId}`);
  });

  socket.on("disconnect", async () => {
    const merchantId = socket.data.merchantId;

    if (merchantId) {
      // Check if there are any remaining sockets in the merchant's room
      const remainingSockets = await io.in(`merchant:${merchantId}`).fetchSockets();

      if (remainingSockets.length === 0) {
        // no more active sockets for this merchant in the entire cluster
        await setMerchantMeta(merchantId, { isOnline: "false", lastSeenAt: Date.now() });
        console.log(`❌ Merchant ${merchantId} fully disconnected`);
        Merchant.findByIdAndUpdate(merchantId, { isOnline: false }).catch(console.error);
      } else {
        console.log(
          `⚠️ Merchant ${merchantId} disconnected socket ${socket.id}, remaining sockets:`,
          remainingSockets.map(s => s.id)
        );
      }
    }
  });
};

export const notifyMerchant = async (io, merchantId, orderData) => {
  console.log(merchantId, orderData, "asdfsadf");

  const meta = await getMerchantMeta(merchantId);

  if (meta && meta.isOnline) {
    io.to(`merchant:${merchantId}`).emit("newOrder", orderData);
    console.log(`📩 Sent newOrder to Merchant ${merchantId} room`);
  } else {
    console.log(
      `⚠️ Merchant ${merchantId} is offline, maybe send push notification`
    );
  }
};
