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

  const newMeta = {
    isOnline: "true",
    isBusy: currentMeta?.isBusy || "false",
    socketId: socket.id,
    lastSeenAt: Date.now(),
  };
  if (orderIdIfAny) newMeta.assignedOrderId = orderIdIfAny;

  await setRiderMeta(riderId, newMeta);

  // FIX: Pass LNG first, LAT second
  await geoAdd("riders:geo", lng, lat, riderId);  // ← CORRECT ORDER

  await setHeartbeat(riderId, 120);

  const assignedOrderId = newMeta.assignedOrderId || orderIdIfAny;
  if (assignedOrderId) {
    io.to(assignedOrderId).emit("riderLocationUpdate", {
      riderId, lat, lng, ts: Date.now()
    });
  }

  io.to(`riderSocket:${riderId}`).emit("locationAck", { ok: true });

  if (isFirstUpdate) {
    console.log(`Rider ${riderId} is now ONLINE at ${lng},${lat}`);
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
      await setRiderMeta(riderId, {
        isOnline: "false",
        isBusy: "false",
        assignedOrderId: "",
        socketId: "",
      });
      console.log(`Rider ${riderId} marked OFFLINE`);
      break;
    }
  }
});
    
}
