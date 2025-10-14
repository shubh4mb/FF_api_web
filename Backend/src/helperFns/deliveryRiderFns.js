   import { redisPub } from "../config/redisConfig.js";
   import {io} from '../../index.js'
  //  import {io} from "../index.js";

   // helper: low-level redis GEOADD via sendCommand (works across redis client versions)
async function geoAdd(key, lng, lat, member) {
    await redisPub.sendCommand(["GEOADD", key, lng.toString(), lat.toString(), member]);
  }
  
  // helper: geo radius search (returns an array of member names)
  async function geoRadius(key, lng, lat, radiusKm, count = 10) {
    console.log("geoRadius input:", { key, lng, lat, radiusKm, count });
    try {
      const reply = await redisPub.sendCommand([
        "GEOSEARCH",
        key,
        "FROMLONLAT", lng.toString(), lat.toString(),
        "BYRADIUS", radiusKm.toString(), "km",
        "WITHDIST",
        "ASC",
        "COUNT", count.toString()
      ]);
      console.log("geoRadius raw reply:", reply);
  
      const result = [];
      if (!Array.isArray(reply)) {
        console.error("geoRadius: Invalid reply format, expected array, got:", reply);
        return result;
      }
  
      // Handle nested array: [['member', 'dist'], ...]
      for (const item of reply) {
        if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
          result.push({ member: item[0], dist: parseFloat(item[1]) });
        } else {
          console.warn("geoRadius: Skipping invalid item:", item);
        }
      }
      console.log("geoRadius parsed result:", result);
      return result;
    } catch (error) {
      console.error("geoRadius error:", error);
      return [];
    }
  }
  
  // helper: set heartbeat (TTL) so offline riders expire
  async function setHeartbeat(riderId, ttlSec = 120) {
    await redisPub.setEx(`rider:heartbeat:${riderId}`, ttlSec, "1");
  }
  
  // helper: set rider meta
  async function setRiderMeta(riderId, obj) {
    const flat = [];
    for (const k in obj) {
      flat.push(k, String(obj[k]));
    }
    if (flat.length) await redisPub.hSet(`rider:${riderId}:meta`, flat);
  }
  
  // helper: get rider meta
  async function getRiderMeta(riderId) {
    // console.log("riderMeta", meta)
    return redisPub.hGetAll(`rider:${riderId}:meta`);
  }
  
  // helper: try acquire simple lock (SET NX PX)
  async function acquireLock(key, ttlMs = 10000) {
    const res = await redisPub.set(key, "1", { NX: true, PX: ttlMs });
    return res === "OK";
  }
  
  // release lock
  async function releaseLock(key) {
    await redisPub.del(key);
  }
  
  
  /** ASSIGNMENT: find nearest rider and notify them
   * - pickupLocation: { lng, lat }
   * - orderId, orderPayload
   */
  async function assignNearestRider(pickupLocation, orderId, orderPayload) {
    const GEO_KEY = "riders:geo";
    const { lng, lat } = pickupLocation;
  
    console.log("assignNearestRider input:", { lng, lat, orderId });
  
    // 1️⃣ Find nearby riders within 20 km
    const candidates = await geoRadius(GEO_KEY, lng, lat, 20, 20);
    console.log("Candidates:", candidates);
    if (!candidates.length) {
      console.log("No candidates found within 20 km");
      return null;
    }
  
    for (const candidate of candidates) {
      const riderId = candidate.member;
      if (typeof riderId !== 'string' || !riderId) {
        console.log(`Invalid riderId in candidate:`, candidate);
        continue;
      }
      console.log(`Processing rider ${riderId}, distance: ${candidate.dist} km`);
  
      // 2️⃣ Check rider meta: online & not busy
      const meta = await getRiderMeta(riderId);
      console.log(`Rider ${riderId} meta:`, meta);
      if (!meta || Object.keys(meta).length === 0) {
        console.log(`Rider ${riderId} skipped: No metadata or empty metadata`);
        continue;
      }
      if (meta.isOnline !== "true") {
        console.log(`Rider ${riderId} skipped: Not online (isOnline: ${meta.isOnline})`);
        continue;
      }
      if (meta.isBusy === "true") {
        console.log(`Rider ${riderId} skipped: Busy (isBusy: ${meta.isBusy})`);
        continue;
      }
  
      // 3️⃣ Acquire per-order lock to avoid race
      const lockKey = `lock:assign:${orderId}`;
      const gotLock = await acquireLock(lockKey, 10000);
      console.log(`Rider ${riderId} lock attempt for ${lockKey}:`, gotLock);
      if (!gotLock) {
        console.log(`Rider ${riderId} skipped: Failed to acquire lock`);
        continue;
      }
  
      try {
        // 4️⃣ Double-check rider is still free
        const freshMeta = await getRiderMeta(riderId);
        console.log(`Rider ${riderId} fresh meta:`, freshMeta);
        if (!freshMeta || Object.keys(freshMeta).length === 0) {
          console.log(`Rider ${riderId} skipped: No fresh metadata or empty`);
          continue;
        }
        if (freshMeta.isBusy === "true") {
          console.log(`Rider ${riderId} skipped: No longer free (isBusy: ${freshMeta.isBusy})`);
          continue;
        }
  
        // 5️⃣ Mark rider as busy with this order
        console.log(`Rider ${riderId} assigning order ${orderId}`);
        await setRiderMeta(riderId, { isBusy: "true", assignedOrderId: orderId });
  
        // 6️⃣ Notify rider via socket
        const socketRoom = freshMeta.socketId || `rider:${riderId}`;
        console.log(`Notifying rider ${riderId} in room: ${socketRoom}`);
        io.to(socketRoom).emit("orderAssigned", { orderId, orderPayload });
        console.log(`📡 Order ${orderId} assigned to rider ${riderId}`);
  
        // 7️⃣ Start a timeout: if rider doesn't accept in 25s, free rider
        const waitingKey = `assign:waiting:${orderId}:${riderId}`;
        await redisPub.setEx(waitingKey, 25, "waiting");
  
        setTimeout(async () => {
          const stillWaiting = await redisPub.get(waitingKey);
          if (stillWaiting) {
            await redisPub.del(waitingKey);
            await setRiderMeta(riderId, { isBusy: "false", assignedOrderId: "" });
            io.to(`rider:${riderId}`).emit("assignmentTimeout", { orderId });
            console.log(`❌ Rider ${riderId} did not accept order ${orderId} in time`);
          }
        }, 25000);
  
        // 8️⃣ Return assigned rider info
        console.log(`Assignment successful for rider ${riderId}`);
        return { riderId, distKm: candidate.dist };
      } catch (error) {
        console.error(`Error assigning rider ${riderId}:`, error);
        continue;
      } finally {
        await releaseLock(lockKey);
        console.log(`Lock ${lockKey} released`);
      }
    }
  
    console.log("❌ No available rider found for order", orderId);
    return null;
  }
  

  export {
    geoAdd,
    geoRadius,
    setHeartbeat,
    setRiderMeta,
    getRiderMeta,
    acquireLock,
    releaseLock,
    assignNearestRider
  };