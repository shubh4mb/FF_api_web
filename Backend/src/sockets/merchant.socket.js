// src/sockets/merchant.socket.js
import Merchant from "../models/merchant.model.js";
import Notification from "../models/notification.model.js";
import { setMerchantMeta, getMerchantMeta } from "../helperFns/merchantFns.js";
import { sendPushNotifications } from "../helperFns/notificationHelper.js";

export const registerMerchantSockets = (io, socket) => {
  const queryMerchantId = socket.handshake.query.merchantId;
  if (queryMerchantId) {
    socket.join(`merchant:${queryMerchantId}`);
    socket.data.merchantId = queryMerchantId;
    console.log(`🔌 [Socket] Merchant ${queryMerchantId} auto-joined room merchant:${queryMerchantId} from handshake query`);
  }

  socket.on("registerMerchant", async (merchantId) => {
    if (!merchantId) return;
    const mId = String(merchantId);
    socket.join(`merchant:${mId}`);
    socket.data.merchantId = mId;

    let isStoreOnline = false;
    try {
      const merchant = await Merchant.findById(mId);
      if (merchant) {
        isStoreOnline = Boolean(merchant.isOnline);
        if (merchant.accountType === 'warehouse') {
          const whId = merchant.warehouseId || merchant.assignedWarehouse;
          if (whId) {
            socket.join(`warehouse:${whId}`);
            socket.data.warehouseId = String(whId);
            console.log(`✅ Warehouse operator ${mId} also joined warehouse room warehouse:${whId}`);
          }
        }
      }
    } catch (err) {
      console.warn("Error resolving merchant warehouse rooms:", err);
    }

    // Update Redis State with merchant's actual online status from DB
    await setMerchantMeta(mId, { lastSeenAt: Date.now(), isOnline: isStoreOnline }).catch(() => {});

    console.log(`✅ Merchant ${mId} registered socket ${socket.id} to room merchant:${mId}`);
  });

  socket.on("registerWarehouse", async (warehouseId) => {
    if (!warehouseId) return;
    const whId = String(warehouseId);
    socket.join(`warehouse:${whId}`);
    socket.data.warehouseId = whId;
    console.log(`✅ Merchant socket ${socket.id} joined warehouse room warehouse:${whId}`);
  });

  socket.on("disconnect", async () => {
    const merchantId = socket.data.merchantId;

    if (merchantId) {
      // Check if there are any remaining sockets in the merchant's room
      const remainingSockets = await io.in(`merchant:${merchantId}`).fetchSockets();

      if (remainingSockets.length === 0) {
        // no more active sockets for this merchant in the entire cluster
        await setMerchantMeta(merchantId, { lastSeenAt: Date.now(), isOnline: false });
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

  // Always emit both event names for maximum client compatibility
  io.to(room).emit("newOrder", orderData);
  io.to(room).emit("newWarehouseOrder", orderData);
  console.log(`📩 [Socket] Emitted newOrder & newWarehouseOrder to room ${room}`);

  // Broadcast to Admin live monitor across all merchants
  try {
    let adminPayload = orderData;
    if (typeof orderData === 'object' && orderData !== null) {
      if (!orderData.merchantId?.shopName && !orderData.merchantDetails?.name && mId) {
        const merchantDoc = await Merchant.findById(mId).select('shopName phoneNumber address logo fulfillmentType').lean();
        if (merchantDoc) {
          adminPayload = {
            ...orderData,
            merchantId: merchantDoc,
            merchantDetails: {
              name: merchantDoc.shopName,
              phone: merchantDoc.phoneNumber,
            }
          };
        }
      }
    }
    io.to("admin:orders").emit("newOrder", adminPayload);
    io.to("admin").emit("newOrder", adminPayload);
    console.log(`📩 [Socket] Emitted newOrder to room admin:orders for merchant ${mId}`);
  } catch (adminEmitErr) {
    io.to("admin:orders").emit("newOrder", orderData);
    console.warn("Error enriching adminPayload for newOrder:", adminEmitErr);
  }

  // Send Push Notification & Save Notification in DB
  try {
    let title = "New Notification 🔔";
    let body = typeof orderData === 'string' ? orderData : "You have a new update.";
    let data = {};
    const orderId = (typeof orderData === 'object' && orderData !== null) ? (orderData._id ? String(orderData._id) : null) : null;

    if (orderId) {
      title = "New Order Received! 🛍️";
      const shortId = orderId.slice(-6).toUpperCase();
      body = `Order #${shortId} has been placed. Prepare items.`;
      data = { orderId, order: orderData };

      // Emit notification event to merchant room
      io.to(room).emit("notification", {
        type: "new_order_placed",
        title,
        body,
        orderId,
        data: { orderId, order: orderData },
        createdAt: new Date().toISOString(),
      });

      // Save notification to DB for notification center
      Notification.create({
        merchantId: mId,
        orderId,
        type: "new_order_placed",
        title,
        body,
        data: { orderId },
      }).catch(dbErr => console.error("Error creating merchant DB notification:", dbErr.message));
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
