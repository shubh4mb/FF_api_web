export const registerDeliveryRiderSockets = (io, socket) => {

    socket.on("registerRider", async ({ riderId }) => {
        // map socket -> rider room and store socketId in meta
        socket.join(`riderSocket:${riderId}`);    // join a personal socket room
        socket.join(`rider:${riderId}`);          // alternative room for fallback messages
        await setRiderMeta(riderId, { socketId: socket.id });
        console.log(`Rider ${riderId} registered on socket ${socket.id}`);
      });
    
      // Rider goes online (initial)
      socket.on("riderOnline", async ({ riderId, lat, lng }) => {
        // store in geo
        await geoAdd("riders:geo", lng, lat, riderId);
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
        await geoAdd("riders:geo", lng, lat, riderId);
        // update meta heartbeat
        await setHeartbeat(riderId, 120);
        await setRiderMeta(riderId, { lastSeenAt: Date.now() });
    
        // if rider is already assigned and is in an order room, forward update to that room
        const meta = await getRiderMeta(riderId);
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
        // find rider by socket id (we stored socketId in meta)
        // naive approach: you might keep a reverse map socketId->riderId in Redis for faster lookup
        console.log("socket disconnected", socket.id);
        // For production: implement reverse lookup to mark that rider offline when disconnect
      });
}
