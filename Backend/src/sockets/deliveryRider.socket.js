import DeliveryRider from "../models/deliveryRider.model.js";
import { geoAdd, geoRadius, setHeartbeat, setRiderMeta, getRiderMeta } from "../helperFns/deliveryRiderFns.js";
import { redis, inMemoryIndex } from "../config/redisConfig.js";
// import { setRiderMeta } from "../helperFns/deliveryRiderFns.js";
import { inferZone } from "../utils/zoneInfer.js";
import { heartbeatSession } from "../helperFns/onlineSessionHelper.js";
import PendingOrder from "../models/pendingOrders.model.js";
import Order from "../models/order.model.js";
import WarehouseOrder from "../models/warehouseOrder.model.js";
import { clearRiderTimeout } from "../helperFns/riderTimeoutHelper.js";
import { matchQueuedOrders } from "../helperFns/orderFns.js";
export const registerDeliveryRiderSockets = (io, socket) => {
  // Pre-join rooms immediately upon socket connection if riderId was sent in handshake query
  const queryRiderId = socket.handshake?.query?.riderId;
  if (queryRiderId) {
    const qStr = queryRiderId.toString();
    socket.join(`riderSocket:${qStr}`);
    socket.join(`rider:${qStr}`);
    socket.join(qStr);
    socket.data.riderId = qStr;
    console.log(`🔌 Delivery rider socket ${socket.id} pre-joined rooms for ${qStr}`);
  }

  // ── Rider Heartbeat Ping ──
  socket.on("ping", async (data) => {
    const riderId = data?.riderId || socket.data?.riderId || socket.handshake?.query?.riderId;
    if (riderId) {
      try {
        const riderIdStr = riderId.toString();
        const meta = await getRiderMeta(riderIdStr);
        const zoneId = meta?.zoneId || 'global';
        await setHeartbeat(riderIdStr, zoneId, 120);
        await heartbeatSession(riderIdStr);
        if (meta && Object.keys(meta).length > 0) {
          await setRiderMeta(riderIdStr, zoneId, {
            ...meta,
            lastSeenAt: Date.now(),
            isOnline: "true",
          });
        }
      } catch (err) {
        console.error("Error handling rider ping:", err.message);
      }
    }
    socket.emit("pong");
  });

  socket.on("registerRider", async ({ riderId }) => {
    const targetId = riderId || socket.handshake?.query?.riderId || socket.data?.riderId;
    if (!targetId) {
      return console.warn(`registerRider called with no riderId on socket ${socket.id}`);
    }
    const riderIdStr = targetId.toString();

    // Guard: if already registered on THIS exact socket connection, just refresh heartbeat and do not re-emit
    if (socket.data?.riderId === riderIdStr && socket.data?.isRegistered) {
      await heartbeatSession(riderIdStr);
      return;
    }
    socket.data.isRegistered = true;

    // map socket -> rider room and store socketId in meta
    const rider = await DeliveryRider.findByIdAndUpdate(riderIdStr, { isAvailable: true });
    if (!rider) {
      return socket.emit("error", "Rider not found");
    }
    socket.join(`riderSocket:${riderIdStr}`);    // join a personal socket room
    socket.join(`rider:${riderIdStr}`);
    socket.join(riderIdStr);
    socket.data.riderId = riderIdStr; // Save riderId for O(1) lookup on disconnect

    const currentMeta = await getRiderMeta(riderIdStr);
    const keepOrder = currentMeta?.assignedOrderId || rider?.currentOrderId?.toString() || "";
    const isBusy = currentMeta?.isBusy || !!keepOrder;
    const zoneId = currentMeta?.zoneId || 'global';

    await setRiderMeta(riderIdStr, zoneId, {
      socketId: socket.id,
      isOnline: "true",
      isBusy: isBusy.toString(),
      assignedOrderId: keepOrder
    });
    await setHeartbeat(riderIdStr, zoneId, 120);
    await heartbeatSession(riderIdStr);
    console.log(`Rider ${riderIdStr} registered on socket ${socket.id}. Busy: ${isBusy}`);

    // If rider is online and not busy, ensure they are in Geo and trigger matcher
    if (!isBusy && rider.location?.coordinates?.length === 2) {
      const [lng, lat] = rider.location.coordinates;
      if (lng && lat) {
        await geoAdd(zoneId, lng, lat, riderIdStr);
        io.emit(`riderAvailable:${zoneId}`, { zoneId, riderId: riderIdStr });
      }
    }

    // If rider has an active order, emit it again so their frontend can resume
    if (keepOrder) {
      try {
        let fullOrder = await Order.findById(keepOrder)
          .populate('merchantId', 'shopName address')
          .populate('userId', 'name phoneNumber')
          .lean();
        if (!fullOrder) {
          fullOrder = await WarehouseOrder.findById(keepOrder)
            .populate('warehouseId', 'name address')
            .populate('sourceMerchantId', 'shopName')
            .populate('userId', 'name phoneNumber')
            .lean();
          if (fullOrder) {
            fullOrder.merchantId = {
              _id: fullOrder.warehouseId?._id || fullOrder.warehouseId,
              shopName: fullOrder.warehouseDetails?.name || fullOrder.warehouseId?.name || "Warehouse Hub",
              address: fullOrder.warehouseId?.address || fullOrder.pickupLocation,
            };
          }
        }

        const isCompletedOrCancelled =
          !fullOrder ||
          ["completed", "cancelled"].includes(fullOrder.deliveryRiderStatus) ||
          ["completed", "cancelled"].includes(fullOrder.orderStatus);

        if (isCompletedOrCancelled) {
          // Clear completed/cancelled order from redis meta
          await setRiderMeta(riderIdStr, zoneId, {
            assignedOrderId: "",
            isBusy: "false",
          });
        } else {
          const isAssignedOrOffered = fullOrder.deliveryRiderId?.toString() === riderIdStr || keepOrder === fullOrder._id.toString();
          if (isAssignedOrOffered) {
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

            const riderPayload = {
              _id: fullOrder._id,
              orderId: fullOrder._id.toString(),
              orderStatus: fullOrder.orderStatus,
              deliveryRiderStatus: fullOrder.deliveryRiderStatus,
              pickupLocation: fullOrder.pickupLocation,
              deliveryLocation: fullOrder.deliveryLocation,
              address: fullOrder.deliveryLocation?.addressLine1 || fullOrder.deliveryLocation?.street || "No address",
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
              cutomerAddress: fullOrder.deliveryLocation?.addressLine1 || "No address",
            };

            const isAlreadyAccepted =
              (fullOrder.deliveryRiderId?.toString() === riderIdStr || !!fullOrder.deliveryRiderId) &&
              !["queued", "unassigned"].includes(fullOrder.deliveryRiderStatus);

            if (isAlreadyAccepted) {
              // Order already accepted and in-progress: emit orderUpdate to resume state
              // NEVER emit orderAssigned here as that triggers the new order siren alert and resets to step 0
              socket.emit('orderUpdate', riderPayload);
              console.log(`Re-sent active order ${keepOrder} (status: ${fullOrder.deliveryRiderStatus}) as orderUpdate to reconnecting rider ${riderIdStr}`);
            } else {
              // Order is still an unaccepted offer (in 2-minute decision window)
              socket.emit('orderAssigned', { orderId: keepOrder, orderPayload: riderPayload });
              console.log(`Re-sent pending order offer ${keepOrder} to reconnecting rider ${riderIdStr}`);
            }
          }
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

    let assignedOrderId = orderIdIfAny || "";
    if (!assignedOrderId && currentMeta?.assignedOrderId) {
      try {
        let checkOrder = await Order.findById(currentMeta.assignedOrderId).select("orderStatus deliveryRiderStatus");
        if (!checkOrder) {
          checkOrder = await WarehouseOrder.findById(currentMeta.assignedOrderId).select("orderStatus deliveryRiderStatus");
        }
        if (checkOrder && !["completed", "cancelled"].includes(checkOrder.orderStatus) && !["completed", "cancelled"].includes(checkOrder.deliveryRiderStatus)) {
          assignedOrderId = currentMeta.assignedOrderId;
        } else {
          assignedOrderId = "";
        }
      } catch (err) {
        assignedOrderId = "";
      }
    }

    const newMeta = {
      isOnline: true,
      isBusy: !!assignedOrderId,
      socketId: socket.id,
      lastSeenAt: Date.now(),
      zoneId,  // ← Save zone in rider's meta
      assignedOrderId,
    };

    // Save meta with zone
    await setRiderMeta(riderId, zoneId, newMeta);

    // Put rider in the correct zoned Redis geo set only if online and NOT busy
    if (newMeta.isOnline && !newMeta.isBusy && !newMeta.assignedOrderId) {
      await geoAdd(zoneId, lng, lat, riderId);
    }

    // Heartbeat with zone
    await setHeartbeat(riderId, zoneId, 120);
    await heartbeatSession(riderId);

    // ONLY TRIGGER THE QUEUE MATCHER IF RIDER IS TRULY AVAILABLE (not busy, no assigned order)
    if (newMeta.isOnline && !newMeta.isBusy && !newMeta.assignedOrderId) {
      io.emit(`riderAvailable:${zoneId}`, { zoneId, riderId });
    }

    // Send live location to customer if rider has an order
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
            _id: keepOrder.toString(),
            orderId: keepOrder.toString(),
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
