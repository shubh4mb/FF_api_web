// src/sockets/merchant.socket.js
import Merchant from "../models/merchant.model.js";
import { setMerchantMeta, getMerchantMeta } from "../helperFns/merchantFns.js";

export const registerMerchantSockets = (io, socket) => {
  socket.on("registerMerchant", async (merchantId) => {
    const merchant = await Merchant.findByIdAndUpdate(merchantId, { isOnline: true });
    if (!merchant) return;

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
  const mId = String(merchantId);
  const room = `merchant:${mId}`;

  // Always attempt to emit to the socket room first
  io.to(room).emit("newOrder", orderData);
  console.log(`📩 [Socket] Attempted newOrder emission to room ${room}`);

  // Then check Redis meta for fallback/logging purposes
  try {
    const meta = await getMerchantMeta(mId);
    if (!meta || !meta.isOnline) {
      console.log(`⚠️ Merchant ${mId} is marked OFFLINE in Redis. Push/SMS might be needed.`);
    } else {
      console.log(`✅ Merchant ${mId} is marked ONLINE in Redis.`);
    }
  } catch (err) {
    console.error(`❌ Error fetching merchant meta for ${mId}:`, err);
  }
};
