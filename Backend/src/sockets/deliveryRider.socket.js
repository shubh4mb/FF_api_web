import DeliveryRider from "../models/deliveryRider.model.js";
import { geoAdd, geoRadius, setHeartbeat, setRiderMeta, getRiderMeta } from "../helperFns/deliveryRiderFns.js";
import { redis, inMemoryIndex } from "../config/redisConfig.js";
// import { setRiderMeta } from "../helperFns/deliveryRiderFns.js";
import { inferZone } from "../utils/zoneInfer.js";
import { matchQueuedOrders } from "../helperFns/orderFns.js";

export const registerDeliveryRiderSockets = (io, socket) => {

    socket.on("registerRider", async ({ riderId }) => {
        // map socket -> rider room and store socketId in meta
        const rider = await DeliveryRider.findById(riderId);
        if (!rider) {
          return socket.emit("error", "Rider not found");
        }
        rider.isAvailable = true;
        await rider.save();
        socket.join(`riderSocket:${riderId}`);    // join a personal socket room
        socket.join(`rider:${riderId}`);   
        // await geoAdd("riders:geo", lng, lat, riderId);       // alternative room for fallback messages
        await setRiderMeta(riderId, { socketId: socket.id, isOnline: "true", isBusy: "false" });
        await setHeartbeat(riderId, 120);
        console.log(`Rider ${riderId} registered on socket ${socket.id}`);
      });
    
    
    
      // Rider sends location updates frequently 
     // deliveryRider.socket.js
socket.on("updateLocation", async ({ riderId, lat, lng, orderIdIfAny = null }) => {
  console.log("updateLocation", riderId, lat, lng, orderIdIfAny);

  const currentMeta = await getRiderMeta(riderId);
  const isFirstUpdate = !currentMeta || Object.keys(currentMeta).length === 0;

  // THIS IS THE MAGIC LINE — GET ZONE FROM YOUR DB
  // const zoneId = await inferZone(lat, lng);
  const zoneId = "Kadavanthara"
  console.log(`Rider ${riderId} detected in zone: ${zoneId}`);

  const newMeta = {
    isOnline: true,
    isBusy: currentMeta?.isBusy === true || false,
    socketId: socket.id,
    lastSeenAt: Date.now(),
    zoneId,  // ← Save zone in rider's meta
  };
  if (orderIdIfAny) newMeta.assignedOrderId = orderIdIfAny;

  // Save meta with zone
  await setRiderMeta(riderId, zoneId, newMeta);

  // Put rider in the correct zoned Redis geo set
 if (!newMeta.isBusy && newMeta.isOnline) {
    await geoAdd(zoneId, lng, lat, riderId);
  }

  // Heartbeat with zone
  await setHeartbeat(riderId, zoneId, 120);

  // THIS TRIGGERS THE QUEUE MATCHER
  io.emit(`riderAvailable:${zoneId}`, { zoneId, riderId });

  // Send live location to customer if rider has an order
  const assignedOrderId = newMeta.assignedOrderId || orderIdIfAny;
  if (assignedOrderId) {
    io.to(assignedOrderId).emit("riderLocationUpdate", {
      riderId,
      lat,
      lng,
      ts: Date.now(),
    });
  }

  io.to(`riderSocket:${riderId}`).emit("locationAck", { ok: true });

  if (isFirstUpdate) {
    console.log(`Rider ${riderId} is now ONLINE in zone ${zoneId} at ${lng},${lat}`);
  }
});
    
      // Rider accepts order
      socket.on("acceptOrder", async ({ riderId, orderId }) => {
        // mark meta
        await setRiderMeta(riderId, { isBusy: "true", assignedOrderId: orderId });
        // make rider join the order room so future updates go to this room
        socket.join(orderId);
        // notify customer/merchant rooms as needed
        io.to(orderId).emit("deliveryAssigned", { riderId, orderId });
      });
    
      // Rider declines or times out — free him
      socket.on("declineOrder", async ({ riderId, orderId }) => {
        await setRiderMeta(riderId, { isBusy: "false", assignedOrderId: "" });
        // notify
        io.to(orderId).emit("deliveryDeclined", { riderId, orderId });
      });
    
      // joinOrderRoom (customer/merchant/rider)
      socket.on("joinOrderRoom", ({ orderId, role }) => {
        socket.join(orderId);
        console.log(`${role || "client"} joined room ${orderId}`);
      });
    
   socket.on("disconnect", async () => {
  console.log("Rider disconnected:", socket.id);

  const keys = await redis.keys("rider:*:meta");
  for (const key of keys) {
    const meta = await redis.hGetAll(key);
    if (meta.socketId === socket.id) {
      const riderId = key.split(":")[1];
      const zoneId = meta.zoneId || 'global'; // ← get from stored meta

      await setRiderMeta(riderId, zoneId, {
        isOnline: false,
        isBusy: false,
        assignedOrderId: "",
        socketId: "",
        zoneId // optional: keep it
      });

      console.log(`Rider ${riderId} marked OFFLINE in zone ${zoneId}`);
      io.emit(`riderFreed:${zoneId}`, { zoneId, riderId }); // ← trigger matcher!
      break;
    }
  }
});
    
}
