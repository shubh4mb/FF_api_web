// src/helperFns/deliveryRiderFns.js
import { redis, inMemoryIndex } from "../config/redisConfig.js";  // Fixed: Added inMemoryIndex
import { io } from "../../index.js";  // Assuming io for emit

// GEOADD wrapper (unused here, but exported)
async function geoAdd(key, lng, lat, member) {
  await redis.geoAdd(key, lng, lat, member);
}

// GEO radius search
async function geoRadius(key, lng, lat, radiusKm, count = 10) {
  try {
    const result = await redis.geoSearch(key, lng, lat, radiusKm, count);
    console.log("geoSearch raw result:", result); // Debug
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("geoRadius error:", error);
    return []; 
  }
}

// Heartbeat
async function setHeartbeat(riderId, ttlSec = 120) {
  await redis.setEx(`rider:heartbeat:${riderId}`, ttlSec, "1");
}

// Rider meta – with type parsing
async function setRiderMeta(riderId, obj) {
  const flat = {};
  for (const k in obj) {
    flat[k] = String(obj[k]);
  } 
  if (Object.keys(flat).length) {
    await redis.hSet(`rider:${riderId}:meta`, flat);
    inMemoryIndex.add(`rider:${riderId}:meta`);  // Now defined
  }
}

async function getRiderMeta(riderId) {
  const rawMeta = await redis.hGetAll(`rider:${riderId}:meta`);
  // Parse strings to types (robust for bools/nums)
  const meta = { ...rawMeta };
  if (meta.isOnline !== undefined) meta.isOnline = meta.isOnline === 'true';
  if (meta.isBusy !== undefined) meta.isBusy = meta.isBusy === 'true';
  if (meta.lastSeenAt !== undefined) meta.lastSeenAt = parseInt(meta.lastSeenAt, 10) || Date.now();
  if (meta.assignedOrderId !== undefined) meta.assignedOrderId = meta.assignedOrderId || '';
  console.log(`Parsed meta for ${riderId}:`, meta);  // Temp debug
  return meta;
}

// Lock
async function acquireLock(key, ttlMs = 10000) {
  const res = await redis.set(key, "1", { NX: true, PX: ttlMs });
  return res === "OK";
}

async function releaseLock(key) {
  await redis.del(key);
}

// Assign nearest rider – complete with lock/heartbeat
async function assignNearestRider(pickupLocation, orderId, orderPayload) {
  const GEO_KEY = "riders:geo";
  const { lat, lng } = pickupLocation;
  let assignedRider = null;

  console.log("Searching riders at (lat, lng):", { lat, lng });

  const candidates = await geoRadius(GEO_KEY, lng, lat, 20, 20);
  console.log("Raw candidates:", candidates);

  if (!candidates?.length) {
    console.log("No riders in GEO range");
    return null;
  }

  for (const { member: riderId, dist } of candidates) {
    console.log(`Checking rider: ${riderId}, dist: ${dist}km`);

    const meta = await getRiderMeta(riderId);
    console.log(`Meta for ${riderId}:`, meta);  // Keep for now

    if (!meta?.isOnline) {
      console.log(`Rider ${riderId} offline`);
      continue;
    }
    if (meta.isBusy) {
      console.log(`Rider ${riderId} busy`);
      continue;
    }

    // Heartbeat check: <5min idle
    const heartbeatKey = `rider:heartbeat:${riderId}`;
    const heartbeat = await redis.get(heartbeatKey);
    if (!heartbeat) {
      console.log(`Rider ${riderId} heartbeat expired`);
      continue;
    }
    const lastSeen = Date.now() - (5 * 60 * 1000);  // 5min threshold
    if (meta.lastSeenAt < lastSeen) {
      console.log(`Rider ${riderId} inactive (lastSeen: ${meta.lastSeenAt})`);
      continue;
    }

    // Acquire lock for assignment
    const lockKey = `assign:lock:${orderId}:${riderId}`;
    if (!(await acquireLock(lockKey))) {
      console.log(`Rider ${riderId} assignment lock failed (concurrent?)`);
      continue;
    }

    try {
      // Assign: Update meta
      await setRiderMeta(riderId, { 
        ...meta, 
        assignedOrderId: orderId, 
        isBusy: true,
        lastSeenAt: Date.now() 
      });
      await setHeartbeat(riderId);

      // Emit to rider socket (if socketId in meta)
      if (meta.socketId) {
        io.to(meta.socketId).emit('orderAssigned', { orderId, orderPayload });
      }

      // Emit to merchant (room by merchantId?)
      // Assuming orderPayload has merchantId; adjust as needed
      const merchantRoom = orderPayload.merchantId ? `merchant:${orderPayload.merchantId}` : null;
      if (merchantRoom) {
        io.to(merchantRoom).emit('riderAssigned', { riderId, orderId });
      }

      assignedRider = riderId;
      console.log(`✅ Assigned rider ${riderId} to order ${orderId}`);
      break;  // First available
    } catch (err) {
      console.error(`Assignment error for ${riderId}:`, err);
    } finally {
      await releaseLock(lockKey);
    }
  }

  if (!assignedRider) {
    console.log("No available rider found within range");
  } else {
    console.log(`Assigned rider: ${assignedRider}`);
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