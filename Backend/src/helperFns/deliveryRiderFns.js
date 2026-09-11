// src/helperFns/deliveryRiderFns.js
import { redis, inMemoryIndex } from "../config/redisConfig.js";
import { getIO } from "../config/socket.js";
import Order from "../models/order.model.js";
import WarehouseOrder from "../models/warehouseOrder.model.js";
import { startRiderTimeout } from "./riderTimeoutHelper.js";
import { notifyOrderEvent } from "./notificationHelper.js";
import { getRoadDistance } from "./orsHelper.js";

// GEOADD wrapper – UPDATED for zone
async function geoAdd(zoneId = 'global', lng, lat, member) {  // NEW: zoneId param, default 'global'
  const key = `riders:geo:${zoneId}`;
  await redis.geoAdd(key, lng, lat, member);
}

// GEO radius search – UPDATED for zone
async function geoRadius(zoneId = 'global', lng, lat, radiusKm, count = 10) {  // NEW: zoneId param
  const key = `riders:geo:${zoneId}`;
  try {
    const result = await redis.geoSearch(key, lng, lat, radiusKm, count);
    console.log("geoSearch raw result:", result);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("geoRadius error:", error);
    return [];
  }
}

// Heartbeat – UPDATED with zone prefix (optional isolation)
async function setHeartbeat(riderId, zoneId = 'global', ttlSec = 120) {  // NEW: zoneId param
  const key = `rider:heartbeat:${riderId}:${zoneId}`;  // NEW: Prefix with zone
  await redis.setEx(key, ttlSec, "1");
}

// Rider meta – UPDATED to include zone
async function setRiderMeta(riderId, zoneId = 'global', obj) {  // NEW: zoneId param, default 'global'
  const flat = { zoneId, ...obj };  // NEW: Bake zone into meta
  for (const k in flat) {
    flat[k] = String(flat[k]);
  }
  if (Object.keys(flat).length) {
    await redis.hSet(`rider:${riderId}:meta`, flat);
    inMemoryIndex.add(`rider:${riderId}:meta`);
  }
}

async function getRiderMeta(riderId) {
  const rawMeta = await redis.hGetAll(`rider:${riderId}:meta`);
  const meta = { ...rawMeta };
  if (meta.isOnline !== undefined) meta.isOnline = meta.isOnline === 'true';
  if (meta.isBusy !== undefined) meta.isBusy = meta.isBusy === 'true';
  if (meta.lastSeenAt !== undefined) meta.lastSeenAt = parseInt(meta.lastSeenAt, 10) || Date.now();
  if (meta.assignedOrderId !== undefined) meta.assignedOrderId = meta.assignedOrderId || '';
  if (meta.zoneId !== undefined) meta.zoneId = meta.zoneId;  // NEW: Parse zone (string)
  // console.log(`Parsed meta for ${riderId}:`, meta);
  return meta;
}

// Lock – UPDATED with zone prefix
async function acquireLock(key, zoneId = 'global', ttlMs = 10000) {  // NEW: zoneId param (if needed for key)
  const fullKey = key.includes(':') ? `${key}:${zoneId}` : key;  // NEW: Prefix if not already
  const res = await redis.set(fullKey, "1", { NX: true, PX: ttlMs });
  return res === "OK";
}

async function releaseLock(key, zoneId = 'global') {  // NEW: zoneId param
  const fullKey = key.includes(':') ? `${key}:${zoneId}` : key;
  await redis.del(fullKey);
}

// Assign nearest rider – complete with lock/heartbeat
// Assign nearest rider – MAIN UPDATE: Add zoneId param, use zoned fns, check meta zone
async function assignNearestRider(zoneId = 'global', pickupLocation, orderId, orderPayload) {  // NEW: zoneId first param, default 'global'
  const { lat, lng } = pickupLocation;
  let assignedRider = null;

  // console.log(`Searching riders in zone ${zoneId} at (lat, lng):`, { lat, lng });  // UPDATED: Log zone

  const candidates = await geoRadius(zoneId, lng, lat, 20, 20);  // UPDATED: Pass zoneId
  // console.log("Raw candidates:", candidates);

  if (!candidates?.length) {
    // console.log(`No riders in zone ${zoneId} GEO range`);  // UPDATED: Log zone
    return null;
  }

  for (const { member: riderId, dist } of candidates) {
    // console.log(`Checking rider: ${riderId}, dist: ${dist}km in ${zoneId}`);  // UPDATED: Log zone

    const meta = await getRiderMeta(riderId);
    // console.log(`Meta for ${riderId}:`, meta);

    if (!meta?.isOnline) {
      // console.log(`Rider ${riderId} offline`);
      continue;
    }
    if (meta.isBusy) {
      console.log(`Rider ${riderId} busy`);
      continue;
    }
    if (meta.assignedOrderId) continue;

    if (meta.zoneId !== zoneId) {  // NEW: Zone match check—skip if rider in wrong zone (e.g., Kaloor for Edapally order)
      console.log(`Rider ${riderId} in wrong zone (${meta.zoneId} != ${zoneId})`);
      continue;
    }

    // Heartbeat check: Pass zoneId
    const heartbeatKey = `rider:heartbeat:${riderId}:${zoneId}`;  // UPDATED: Use prefixed key
    const heartbeat = await redis.get(heartbeatKey);
    if (!heartbeat) {
      console.log(`Rider ${riderId} heartbeat expired in ${zoneId}`);
      continue;
    }
    const lastSeen = Date.now() - (5 * 60 * 1000);
    if (meta.lastSeenAt < lastSeen) {
      console.log(`Rider ${riderId} inactive (lastSeen: ${meta.lastSeenAt})`);
      continue;
    }

    // Acquire lock: Pass prefixed key + zone
    const lockKey = `assign:lock:${orderId}`;  // GLOBAL ORDER LOCK, NOT RIDER LOCK
    if (!(await acquireLock(lockKey, zoneId))) {  // UPDATED: Pass zoneId
      console.log(`Order ${orderId} assignment lock failed (another matcher is handling it?)`);
      return null;
    }

    try {
      // Assign: Update meta, pass zoneId
      await setRiderMeta(riderId, zoneId, {  // UPDATED: Pass zoneId
        ...meta,
        assignedOrderId: orderId,
        isBusy: true,
        lastSeenAt: Date.now()
      });
      await setHeartbeat(riderId, zoneId);  // UPDATED: Pass zoneId

      // Emits unchanged—your socketId/merchant rooms work as-is
      // Inside assignNearestRider — after successful assignment
      // Fetch the FULL order from Order or WarehouseOrder collection
      let fullOrder = await Order.findById(orderId)
        .populate('merchantId', 'shopName address')
        .populate('userId', 'name phoneNumber')
        .lean();

      if (!fullOrder) {
        fullOrder = await WarehouseOrder.findById(orderId)
          .populate('warehouseId', 'name address')
          .populate('sourceMerchantId', 'shopName')
          .populate('userId', 'name phoneNumber')
          .lean();

        if (fullOrder) {
          // Normalize merchantId so rider app displays the warehouse as pickup spot
          fullOrder.merchantId = {
            _id: fullOrder.warehouseId?._id || fullOrder.warehouseId,
            shopName: fullOrder.warehouseDetails?.name || fullOrder.warehouseId?.name || "Warehouse Hub",
            address: fullOrder.warehouseId?.address || fullOrder.pickupLocation,
          };
        }
      }
      console.log(fullOrder, orderId, "fullOrder");

      if (fullOrder) {
        // 🛣️ NEW: Calculate road distance from rider's current location to the merchant
        let riderToShopKm = null;
        let riderToShopMins = null;
        try {
          const pos = await redis.geoPos(`riders:geo:${zoneId}`, riderId);
          if (pos && pos[0]) {
            const riderCoords = [parseFloat(pos[0].longitude), parseFloat(pos[0].latitude)];
            const merchantCoords = fullOrder.pickupLocation.coordinates;
            const road = await getRoadDistance(riderCoords, merchantCoords);
            if (road) {
              riderToShopKm = road.distanceKm;
              riderToShopMins = road.durationMins;
            }
          }
        } catch (err) {
          console.error("Failed to calculate rider-to-shop road distance:", err.message);
        }

        const baseDeliveryCharge = fullOrder.originalDeliveryCharge ?? fullOrder.finalBilling?.deliveryCharge ?? fullOrder.deliveryCharge ?? 0;
        const returnCharge = fullOrder.originalReturnCharge ?? fullOrder.returnCharge ?? 0;
        const deliveryTip = fullOrder.finalBilling?.deliveryTip ?? fullOrder.deliveryTip ?? 0;
        const totalRiderEarnings = baseDeliveryCharge + returnCharge + deliveryTip;

        const customerPhone =
          fullOrder.deliveryLocation?.phone ||
          fullOrder.userId?.phoneNumber ||
          fullOrder.deliveryLocation?.phoneNumber ||
          null;
        const customerName =
          fullOrder.deliveryLocation?.name ||
          fullOrder.userId?.name ||
          "Customer";

        // Format pickup address properly
        const mAddr = fullOrder.merchantId?.address || fullOrder.warehouseId?.address;
        let formattedPickupAddress = "Merchant location";
        if (typeof mAddr === "string") {
          formattedPickupAddress = mAddr;
        } else if (mAddr && typeof mAddr === "object") {
          const parts = [mAddr.street, mAddr.landmark, mAddr.city, mAddr.state, mAddr.postalCode].filter(Boolean);
          if (parts.length > 0) formattedPickupAddress = parts.join(", ");
        }

        // Format customer address properly
        const dAddr = fullOrder.deliveryLocation;
        let formattedCustomerAddress = "Customer delivery address";
        if (dAddr) {
          const parts = [
            dAddr.addressLine1 || dAddr.street,
            dAddr.addressLine2,
            dAddr.landmark,
            dAddr.area,
            dAddr.city,
            dAddr.pincode
          ].filter(Boolean);
          if (parts.length > 0) formattedCustomerAddress = parts.join(", ");
        }

        const shopName =
          fullOrder.merchantId?.shopName ||
          fullOrder.warehouseDetails?.name ||
          fullOrder.warehouseId?.name ||
          "Merchant Store";

        // This matches EXACTLY what your frontend expects
        const riderPayload = {
          _id: fullOrder._id,
          orderId: fullOrder._id.toString(),
          orderStatus: fullOrder.orderStatus,
          deliveryRiderStatus: fullOrder.deliveryRiderStatus,
          pickupLocation: fullOrder.pickupLocation,
          deliveryLocation: fullOrder.deliveryLocation,
          shopName,
          pickupAddress: formattedPickupAddress,
          customerAddress: formattedCustomerAddress,
          deliveryAddress: formattedCustomerAddress,
          address: formattedCustomerAddress,
          customerPhone,
          customerName,
          merchantId: fullOrder.merchantId,
          items: fullOrder.items,
          deliveryCharge: baseDeliveryCharge,
          originalDeliveryCharge: fullOrder.originalDeliveryCharge || baseDeliveryCharge,
          returnCharge: returnCharge,
          originalReturnCharge: fullOrder.originalReturnCharge || returnCharge,
          tip: deliveryTip,
          deliveryTip: deliveryTip,
          finalBilling: fullOrder.finalBilling,
          totalAmount: fullOrder.finalBilling?.totalPayable || fullOrder.totalAmount,
          deliveryAmount: totalRiderEarnings > 0 ? totalRiderEarnings : (fullOrder.deliveryCharge || 100),
          customerLocation: fullOrder.deliveryLocation?.coordinates
            ? {
              lat: fullOrder.deliveryLocation.coordinates[1],
              lng: fullOrder.deliveryLocation.coordinates[0]
            }
            : null,
          cutomerAddress: formattedCustomerAddress,
          // 🆕 New road distance fields
          deliveryDistance: fullOrder.deliveryDistance || 0,
          estimatedTimeToCustomer: fullOrder.estimatedTime || 0,
          riderToShopKm: riderToShopKm ? Number(riderToShopKm.toFixed(2)) : null,
          riderToShopMins: riderToShopMins,
        };

        const io = getIO();
        const riderIdStr = riderId.toString();
        // Emit to rooms and direct socket if available
        io.to(`riderSocket:${riderIdStr}`).emit('orderAssigned', { orderId, orderPayload: riderPayload });
        io.to(`rider:${riderIdStr}`).emit('orderAssigned', { orderId, orderPayload: riderPayload });
        io.to(riderIdStr).emit('orderAssigned', { orderId, orderPayload: riderPayload });
        if (meta?.socketId) {
          io.to(meta.socketId).emit('orderAssigned', { orderId, orderPayload: riderPayload });
        }
        console.log(`Sent full order ${riderPayload.orderId} to rider ${riderIdStr} (meta socket: ${meta?.socketId})`);
      }

      const merchantRoom = orderPayload.merchantId ? `merchant:${orderPayload.merchantId}` : null;
      if (merchantRoom) {
        const io = getIO();
        io.to(merchantRoom).emit('riderAssigned', { riderId, orderId });
      }

      assignedRider = riderId;
      console.log(`✅ Assigned rider ${riderId} to order ${orderId} in ${zoneId}`);

      // Start 2-minute timeout — auto re-queue if rider doesn't accept
      startRiderTimeout(orderId, riderId, zoneId);

      // 📱 Rider notification: "New delivery request"
      notifyOrderEvent("rider", "new_order_request", {
        riderId,
        orderId,
      });

      break;
    } catch (err) {
      console.error(`Assignment error for ${riderId}:`, err);
    } finally {
      await releaseLock(lockKey, zoneId);
    }
  }

  if (!assignedRider) {
    console.log(`No available rider found within range in ${zoneId}`);
  }
  return assignedRider;
}

export {
  geoAdd,
  geoRadius,
  setHeartbeat,
  setRiderMeta,
  getRiderMeta,
  acquireLock,
  releaseLock,
  assignNearestRider,
};