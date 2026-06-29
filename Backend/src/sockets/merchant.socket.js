// src/sockets/merchant.socket.js
import Merchant from "../models/merchant.model.js";
import { setMerchantMeta, getMerchantMeta } from "../helperFns/merchantFns.js";
import { sendPushNotifications } from "../helperFns/notificationHelper.js";

export const registerMerchantSockets = (io, socket) => {
  socket.on("registerMerchant", async (merchantId) => {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return;

    // Join a Socket.io room specific to this merchant
    socket.join(`merchant:${merchantId}`);
    socket.data.merchantId = merchantId; // store merchantId on socket itself

    // Update Redis State
    await setMerchantMeta(merchantId, { lastSeenAt: Date.now() });

    console.log(`✅ Merchant ${merchantId} connected with socket ${socket.id} to room merchant:${merchantId}`);
  });

  socket.on("disconnect", async () => {
    const merchantId = socket.data.merchantId;

    if (merchantId) {
      // Check if there are any remaining sockets in the merchant's room
      const remainingSockets = await io.in(`merchant:${merchantId}`).fetchSockets();

      if (remainingSockets.length === 0) {
        // no more active sockets for this merchant in the entire cluster
        await setMerchantMeta(merchantId, { lastSeenAt: Date.now() });
        console.log(`❌ Merchant ${merchantId} fully disconnected`);
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

  // Send Push Notification
  try {
    let title = "New Notification 🔔";
    let body = typeof orderData === 'string' ? orderData : "You have a new update.";
    let data = {};

    if (typeof orderData === 'object' && orderData !== null) {
      title = "New Order Received! 🛍️";
      const shortId = orderData._id ? String(orderData._id).slice(-5).toUpperCase() : "";
      body = `Order #${shortId} has been placed. Prepare items.`;
      data = { orderId: orderData._id };
    } else if (typeof orderData === 'string') {
      if (orderData.toLowerCase().includes("cancel")) {
        title = "Order Cancelled 🛑";
        body = orderData;
      }
    }

    sendPushNotifications(null, null, title, body, data, mId).catch(err => {
      console.error("Error sending push notification to merchant async:", err);
    });
  } catch (pushErr) {
    console.error("Failed to queue merchant push notification:", pushErr);
  }

  // Then check Redis meta for fallback/logging purposes
  try {
    const meta = await getMerchantMeta(mId);
    if (!meta || !meta.isOnline) {
      console.log(`⚠️ Merchant ${mId} is marked OFFLINE in Redis. Push sent as fallback.`);
    } else {
      console.log(`✅ Merchant ${mId} is marked ONLINE in Redis.`);
    }
  } catch (err) {
    console.error(`❌ Error fetching merchant meta for ${mId}:`, err);
  }
};
