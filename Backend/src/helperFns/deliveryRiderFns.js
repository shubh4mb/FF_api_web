// helper: low-level redis GEOADD via sendCommand (works across redis client versions)
async function geoAdd(key, lng, lat, member) {
    await redisPub.sendCommand(["GEOADD", key, lng.toString(), lat.toString(), member]);
  }
  
  // helper: geo radius search (returns an array of member names)
  async function geoRadius(key, lng, lat, radiusKm, count = 10) {
    // GEORADIUS key longitude latitude radius km WITHDIST ASC COUNT count
    const reply = await redisPub.sendCommand([
      "GEORADIUS",
      key,
      lng.toString(),
      lat.toString(),
      radiusKm.toString(),
      "km",
      "WITHDIST",
      "ASC",
      "COUNT",
      count.toString()
    ]);
    // reply is like [[member, dist], ...]
    return (reply || []).map(r => ({ member: r[0], dist: parseFloat(r[1]) }));
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
  
    // 1) find nearby riders within 5 km
    const candidates = await geoRadius(GEO_KEY, lng, lat, 5, 20); // get up to 20 nearest
    if (!candidates.length) return null;
  
    for (const candidate of candidates) {
      const riderId = candidate.member;
  
      // check rider meta: online & not busy
      const meta = await getRiderMeta(riderId);
      if (!meta || meta.isOnline !== "true" || meta.isBusy === "true") continue;
  
      // acquire per-order lock to avoid race
      const lockKey = `lock:assign:${orderId}`;
      const gotLock = await acquireLock(lockKey, 10000);
      if (!gotLock) {
        // someone else is assigning right now
        continue;
      }
  
      try {
        // double-check set busy atomically: use HSETNX style not available, so check then set
        const freshMeta = await getRiderMeta(riderId);
        if (!freshMeta || freshMeta.isBusy === "true") {
          continue;
        }
  
        // mark rider as busy
        await setRiderMeta(riderId, { isBusy: "true", assignedOrderId: orderId });
  
        // notify rider via socket (socketId saved in meta)
        const socketId = freshMeta.socketId || (await getRiderMeta(riderId)).socketId;
        if (socketId) {
          io.to(socketId).emit("orderAssigned", { orderId, orderPayload });
        } else {
          // fallback: if rider connected to a different pod, socketId might be stale/missing;
          // but since we use Redis adapter, socketId -> actual socket route is handled by socket.io.
          // we can still try by publishing to a socket.io room made for riderId
          io.to(`rider:${riderId}`).emit("orderAssigned", { orderId, orderPayload });
        }
  
        // return assigned rider
        return { riderId, distKm: candidate.dist };
      } finally {
        await releaseLock(lockKey);
      }
    }
  
    return null;
  }