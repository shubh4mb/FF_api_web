import DeliveryRider from "../models/deliveryRider.model.js";
import { geoAdd, geoRadius, setHeartbeat, setRiderMeta, getRiderMeta } from "../helperFns/deliveryRiderFns.js";
import { redis, inMemoryIndex } from "../config/redisConfig.js";
// import { setRiderMeta } from "../helperFns/deliveryRiderFns.js";
import { inferZone } from "../utils/zoneInfer.js";
import { heartbeatSession } from "../helperFns/onlineSessionHelper.js";
import PendingOrder from "../models/pendingOrders.model.js";
import Order from "../models/order.model.js";
import { clearRiderTimeout } from "../helperFns/riderTimeoutHelper.js";
import { matchQueuedOrders } from "../helperFns/orderFns.js";
export const registerDeliveryRiderSockets = (io, socket) => {

  socket.on("registerRider", async ({ riderId }) => {
    // map socket -> rider room and store socketId in meta
    const rider = await DeliveryRider.findByIdAndUpdate(riderId, { isAvailable: true });
    if (!rider) {
      return socket.emit("error", "Rider not found");
    }
    socket.join(`riderSocket:${riderId}`);    // join a personal socket room
    socket.join(`rider:${riderId}`);
    socket.data.riderId = riderId; // Save riderId for O(1) lookup on disconnect
    // await geoAdd("riders:geo", lng, lat, riderId);       // alternative room for fallback messages

    const currentMeta = await getRiderMeta(riderId);
    const keepOrder = currentMeta?.assignedOrderId || "";
    const isBusy = currentMeta?.isBusy || !!keepOrder;
    const zoneId = currentMeta?.zoneId || 'global';

    await setRiderMeta(riderId, zoneId, {
      socketId: socket.id,
      isOnline: "true",
      isBusy: isBusy.toString(),
      assignedOrderId: keepOrder
    });
    await setHeartbeat(riderId, zoneId, 120);
    await heartbeatSession(riderId);
    console.log(`Rider ${riderId} registered on socket ${socket.id}. Busy: ${isBusy}`);

    // If rider has an active order, emit it again so their frontend can resume
    if (keepOrder) {
      try {
        const fullOrder = await Order.findById(keepOrder).populate('merchantId', 'shopName address').lean();

        if (fullOrder && fullOrder.deliveryRiderId?.toString() === riderId && !["completed", "cancelled"].includes(fullOrder.deliveryRiderStatus)) {
          const riderPayload = {
            _id: fullOrder._id,
            orderId: fullOrder._id.toString(),
            orderStatus: fullOrder.orderStatus,
            deliveryRiderStatus: fullOrder.deliveryRiderStatus,
            pickupLocation: fullOrder.pickupLocation,
            deliveryLocation: fullOrder.deliveryLocation,
            address: fullOrder.deliveryLocation?.addressLine1 || fullOrder.deliveryLocation?.street || "No address",
            merchantId: fullOrder.merchantId,
            items: fullOrder.items,
            deliveryCharge: fullOrder.finalBilling?.deliveryCharge || 0,
            totalAmount: fullOrder.finalBilling?.totalPayable || fullOrder.totalAmount,
            deliveryAmount: fullOrder.deliveryCharge || 100,
            customerLocation: fullOrder.deliveryLocation?.coordinates
              ? {
                lat: fullOrder.deliveryLocation.coordinates[1],
                lng: fullOrder.deliveryLocation.coordinates[0]
              }
              : null,
            cutomerAddress: fullOrder.deliveryLocation?.addressLine1 || "No address",
          };
          socket.emit('orderAssigned', { orderId: keepOrder, orderPayload: riderPayload });
          console.log(`Re-sent active order ${keepOrder} to reconnecting rider ${riderId}`);
        }
      } catch (err) {
        console.error("Error resuming order for rider:", err);
      }
    }
  });



  // Rider sends location updates frequently 
  // deliveryRider.socket.js
  socket.on("updateLocation", async ({ riderId, lat, lng, orderIdIfAny = null }) => {
    // console.log("updateLocation", riderId, lat, lng, orderIdIfAny);

    const currentMeta = await getRiderMeta(riderId);
    const isFirstUpdate = !currentMeta || Object.keys(currentMeta).length === 0;

    // THIS IS THE MAGIC LINE — GET ZONE FROM YOUR DB
    const zoneId = await inferZone(lat, lng);

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
    if (newMeta.isOnline && !newMeta.assignedOrderId) {
      await geoAdd(zoneId, lng, lat, riderId);
    }


    // Heartbeat with zone
    await setHeartbeat(riderId, zoneId, 120);
    await heartbeatSession(riderId);

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
    const meta = await getRiderMeta(riderId);

    if (meta.assignedOrderId && meta.assignedOrderId !== orderId) {
      return socket.emit("error", {
        message: "Already handling another order"
      });
    }

    await setRiderMeta(riderId, meta.zoneId, {
      isBusy: true,
      assignedOrderId: orderId,
      lastSeenAt: Date.now()
    });

    socket.join(orderId);
    io.to(orderId).emit("deliveryAssigned", { riderId, orderId });
  });


  // Rider declines or times out — free him
  socket.on("declineOrder", async ({ riderId, orderId }) => {
    const meta = await getRiderMeta(riderId);
    await setRiderMeta(riderId, meta.zoneId || 'global', { isBusy: "false", assignedOrderId: "" });

    // RE-QUEUE ORDER LOGIC
    await PendingOrder.findOneAndUpdate(
      { orderId },
      { status: 'queued', assignedRider: null, assignedAt: null }
    );

    // Notify customer
    io.to(orderId).emit("deliveryDeclined", { riderId, orderId });

    // Re-trigger global matching queue
    io.emit(`orderQueued:${meta.zoneId || 'global'}`, { zoneId: meta.zoneId || 'global', orderId });
  });


  socket.on("disconnect", async () => {
    console.log("Rider disconnected:", socket.id);

    const riderId = socket.data.riderId;
    if (!riderId) return;

    const meta = await getRiderMeta(riderId);
    if (!meta) return;

    const zoneId = meta.zoneId || 'global';
    const keepOrder = meta.assignedOrderId || "";

    // ── Phone-death fast re-queue ──
    // If rider disconnects with an order that was ONLY assigned (not accepted),
    // immediately free the rider and re-queue the order to the next rider.
    if (keepOrder) {
      try {
        const order = await Order.findById(keepOrder);

        if (
          order &&
          order.deliveryRiderId?.toString() === riderId &&
          order.deliveryRiderStatus === "assigned"
        ) {
          // Rider disconnected BEFORE accepting — immediate re-queue
          console.log(`📱💀 Rider ${riderId} disconnected with unaccepted order ${keepOrder}`);

          // 1. Free the rider completely
          await setRiderMeta(riderId, zoneId, {
            isOnline: false,
            isBusy: false,
            assignedOrderId: "",
          });
          await DeliveryRider.findByIdAndUpdate(riderId, {
            currentOrderId: null,
            isBusy: false,
            isAvailable: false, // phone is dead — don't mark available
          });

          // 2. Reset the order for re-queue
          order.deliveryRiderId = null;
          order.deliveryRiderDetails = { name: null, phone: null };
          order.deliveryRiderStatus = "queued";
          await order.save();

          // 3. Re-queue pending order
          await PendingOrder.findOneAndUpdate(
            { orderId: keepOrder.toString() },
            { status: "queued", assignedRider: null, assignedAt: null }
          );

          // 4. Clear the 2-min timeout (no longer needed)
          clearRiderTimeout(keepOrder);

          // 5. Emit update to order room (customer gets notified)
          io.to(keepOrder.toString()).emit("orderUpdate", {
            orderId: keepOrder,
            orderStatus: order.orderStatus,
            deliveryRiderStatus: "queued",
            message: "Rider unavailable, finding new rider...",
          });

          // 6. Trigger matcher to find next rider immediately
          await matchQueuedOrders(zoneId);

          console.log(`✅ Order ${keepOrder} immediately re-queued in zone ${zoneId}`);
          return;
        }
      } catch (err) {
        console.error("Error in disconnect fast re-queue:", err);
      }
    }

    // ── Normal disconnect (no order, or order was already accepted/in-progress) ──
    await setRiderMeta(riderId, zoneId, {
      isOnline: false,
      isBusy: !!keepOrder,
      assignedOrderId: keepOrder,
    });

    console.log(`Rider ${riderId} marked OFFLINE in zone ${zoneId}`);
    if (!keepOrder) {
      io.emit(`riderFreed:${zoneId}`, { zoneId, riderId });
    }
  });

}
