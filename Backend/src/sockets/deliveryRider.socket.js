import DeliveryRider from "../models/deliveryRider.model.js";
import { geoAdd, geoRadius, setHeartbeat, setRiderMeta, getRiderMeta } from "../helperFns/deliveryRiderFns.js";
import { redisPub } from "../config/redisConfig.js";

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
    
      // Rider goes online (initial)
      socket.on("riderOnline", async ({ riderId, lat, lng }) => {
        // store in geo
        await geoAdd("riders:geo", lng, lat, `rider:${riderId}`);

        // set meta
        await setRiderMeta(riderId, { isOnline: "true", isBusy: "false" , lastSeenAt: Date.now() });
        // heartbeat TTL so stale riders vanish
        await setHeartbeat(riderId, 120);
        // inform others (optional)
        console.log(`Rider ${riderId} is online at ${lat},${lng}`);
      });
    
      // Rider sends location updates frequently
      socket.on("updateLocation", async ({ riderId, lat, lng, orderIdIfAny = null }) => {
        // update GEO
        // console.log("updateLocation", riderId, lat, lng, orderIdIfAny);
        await geoAdd("riders:geo", lng, lat, riderId);
        // await geoAdd("riders:geo", lng, lat, `rider:${riderId}`);

        // update meta heartbeat
        await setHeartbeat(riderId, 120);
        await setRiderMeta(riderId, { lastSeenAt: Date.now() });
    
        // if rider is already assigned and is in an order room, forward update to that room
        const meta = await getRiderMeta(riderId);
        // console.log(meta);
        
        const assignedOrderId = meta.assignedOrderId || orderIdIfAny;
        if (assignedOrderId) {
          // emit to order room (all participants joined)
          io.to(assignedOrderId).emit("riderLocationUpdate", { riderId, lat, lng, ts: Date.now() });
        }
    
        // optionally emit to rider personal room for debugging or monitoring
        io.to(`riderSocket:${riderId}`).emit("locationAck", { ok: true });
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
        console.log("socket disconnected", socket.id);
    
        // lookup riderId by socketId
        const keys = await redisPub.keys("rider:*:meta");
        for (const key of keys) {
            const meta = await redisPub.hGetAll(key);
            if (meta.socketId === socket.id) {
                await setRiderMeta(key.split(":")[1], { isOnline: "false" });
                break;
            }
        }
    });
    
}
