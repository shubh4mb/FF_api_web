// src/helperFns/deliveryRiderFns.js
import { redis, inMemoryIndex } from "../config/redisConfig.js";  // Fixed: Added inMemoryIndex
import { io } from "../../index.js";  // Assuming io for emit

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
  console.log(`Parsed meta for ${riderId}:`, meta);
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

  console.log(`Searching riders in zone ${zoneId} at (lat, lng):`, { lat, lng });  // UPDATED: Log zone

  const candidates = await geoRadius(zoneId, lng, lat, 20, 20);  // UPDATED: Pass zoneId
  console.log("Raw candidates:", candidates);

  if (!candidates?.length) {
    console.log(`No riders in zone ${zoneId} GEO range`);  // UPDATED: Log zone
    return null;
  }

  for (const { member: riderId, dist } of candidates) {
    console.log(`Checking rider: ${riderId}, dist: ${dist}km in ${zoneId}`);  // UPDATED: Log zone

    const meta = await getRiderMeta(riderId);
    console.log(`Meta for ${riderId}:`, meta);

    if (!meta?.isOnline) {
      console.log(`Rider ${riderId} offline`);
      continue;
    }
    if (meta.isBusy) {
      console.log(`Rider ${riderId} busy`);
      continue;
    }
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
    const lockKey = `assign:lock:${orderId}:${riderId}`;  // Keep base, but acquire passes zone
    if (!(await acquireLock(lockKey, zoneId))) {  // UPDATED: Pass zoneId
      console.log(`Rider ${riderId} assignment lock failed (concurrent?)`);
      continue;
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
      if (meta.socketId) {
        io.to(meta.socketId).emit('orderAssigned', { orderId, orderPayload });
      }

      const merchantRoom = orderPayload.merchantId ? `merchant:${orderPayload.merchantId}` : null;
      if (merchantRoom) {
        io.to(merchantRoom).emit('riderAssigned', { riderId, orderId });
      }

      assignedRider = riderId;
      console.log(`✅ Assigned rider ${riderId} to order ${orderId} in ${zoneId}`);  // UPDATED: Log zone
      break;
    } catch (err) {
      console.error(`Assignment error for ${riderId}:`, err);
    } finally {
      await releaseLock(lockKey, zoneId);  // UPDATED: Pass zoneId
    }
  }

  if (!assignedRider) {
    console.log(`No available rider found within range in ${zoneId}`);  // UPDATED: Log zone
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