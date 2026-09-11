import Order from "../../models/order.model.js";
import WarehouseOrder from "../../models/warehouseOrder.model.js";
import deliveryRiderModel from "../../models/deliveryRider.model.js";
import PendingOrder from "../../models/pendingOrders.model.js";
import { getRiderMeta, setRiderMeta, geoAdd, setHeartbeat } from "../../helperFns/deliveryRiderFns.js";
import { getIO } from "../../config/socket.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { notifyOrderEvent } from "../../helperFns/notificationHelper.js";
import { clearRiderTimeout } from "../../helperFns/riderTimeoutHelper.js";
import { inferZone } from "../../utils/zoneInfer.js";
import { heartbeatSession, addOrderToSession } from "../../helperFns/onlineSessionHelper.js";
import { calculateFinalBilling } from "../../helperFns/calculateFinalBilling.js";

// Universal helper to find Order or WarehouseOrder by ID
const findAnyOrderById = async (orderId) => {
  if (!orderId) return null;
  const cleanId = String(orderId).replace(/^["']|["']$/g, '').trim();
  let order = await Order.findById(cleanId);
  if (!order) {
    order = await WarehouseOrder.findById(cleanId);
  }
  return order;
};

const findAnyOrderPopulated = async (orderId) => {
  if (!orderId) return null;
  const cleanId = String(orderId).replace(/^["']|["']$/g, '').trim();
  let order = await Order.findById(cleanId)
    .populate('merchantId')
    .populate('userId', 'name phoneNumber');
  if (!order) {
    order = await WarehouseOrder.findById(cleanId)
      .populate('warehouseId')
      .populate('sourceMerchantId')
      .populate('userId', 'name phoneNumber');
    if (order && !order.merchantId) {
      order.merchantId = {
        _id: order.warehouseId?._id || order.warehouseId,
        shopName: order.warehouseDetails?.name || order.warehouseId?.name || "Warehouse Hub",
        address: order.warehouseId?.address || order.pickupLocation,
        phone: order.warehouseId?.phone || order.merchantDetails?.phone || null,
      };
    }
  }
  return order;
};

// Haversine formula to calculate distance between two points in meters
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

export const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const rider = await deliveryRiderModel.findById(req.riderId);
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    const order = await findAnyOrderPopulated(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Prevent other riders from accepting
    if (order.deliveryRiderId && order.deliveryRiderId.toString() !== rider._id.toString()) {
      return res.status(403).json({ message: 'Order already assigned to another rider' });
    }

    // Guard: allow acceptance when order is merchant-approved or packed
    if (!['accepted', 'packed'].includes(order.orderStatus)) {
      return res.status(400).json({ message: `Order cannot be accepted in "${order.orderStatus}" status` });
    }

    // Update order fields — rider assignment only
    // Delivery charge & billing are already set during order creation (appConfig-based)
    order.deliveryRiderId = rider._id;
    order.deliveryRiderStatus = 'assigned';

    // Save rider details
    order.deliveryRiderDetails = {
      name: rider.fullName,
      phone: rider.phone
    };

    await order.save();

    // ⏰ Clear the 2-minute timeout — rider accepted in time
    clearRiderTimeout(orderId);
    clearRiderTimeout(order._id.toString());

    // ✅ Remove from the matching queue so ghost assignments don't happen later
    await PendingOrder.deleteMany({ orderId: { $in: [orderId, order._id.toString()] } });

    // Update rider's current order
    rider.currentOrderId = orderId;
    rider.isBusy = true;
    await rider.save();

    // Sync busy status to Redis
    try {
      const meta = await getRiderMeta(rider._id.toString());
      await setRiderMeta(rider._id.toString(), meta?.zoneId || 'global', {
        ...meta,
        isBusy: true,
        assignedOrderId: order._id.toString(),
        lastSeenAt: Date.now()
      });
    } catch (redisErr) {
      console.error("Failed to update Redis meta on acceptOrder:", redisErr);
    }

    // Emit real-time update
    emitOrderUpdate(req.io, orderId, order);

    return res.status(200).json({
      message: 'Order accepted successfully',
      order: {
        _id: order._id,
        orderStatus: order.orderStatus,
        deliveryCharge: order.deliveryCharge,
        totalAmount: order.totalAmount,
        finalBilling: order.finalBilling,
      }
    });

  } catch (error) {
    console.error('Error in acceptOrder:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const reachedPickupLocation = async (req, res) => {
  console.log("hitting reachedPickupLocation");
  try {
    const { orderId, latitude, longitude } = req.body;
    // console.log(orderId,latitude,longitude,"orderId, latitude, longitude");

    // Validate request body
    if (!orderId || latitude == null || longitude == null) {
      return res.status(400).json({ message: 'orderId, latitude, and longitude are required' });
    }

    // Validate rider
    const rider = await deliveryRiderModel.findById(req.riderId);
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    // Validate order
    const order = await findAnyOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.deliveryRiderId?.toString() !== req.riderId.toString()) {
      console.log(order.deliveryRiderId?.toString(), req.riderId.toString());

      return res.status(403).json({ message: 'Not authorized for this order' });
    }
    // Validate pickup location exists on order
    if (!order.pickupLocation?.coordinates?.length) {
      return res.status(400).json({ message: 'Order pickup location not set' });
    }
    const [pickupLng, pickupLat] = order.pickupLocation.coordinates;
    const pickupLocation = {
      latitude: pickupLat,
      longitude: pickupLng,
    };

    // Calculate distance
    const distance = getDistance(
      latitude,
      longitude,
      pickupLocation.latitude,
      pickupLocation.longitude
    );

    // Soft check — log but don't block (GPS can be inaccurate)
    if (distance > 500) {
      console.warn(`Rider ${distance.toFixed(0)}m from pickup — may not be at location`);
    }


    // Update order status
    order.deliveryRiderStatus = 'at_pickup';
    await order.save();
    await PendingOrder.findOneAndDelete({ orderId: orderId });

    // Emit order update
    emitOrderUpdate(req.io, orderId, order);


    res.status(200).json({ message: 'Rider confirmed at pickup location' });
  } catch (error) {
    console.error('Error in reachedPickupLocation:', error);
    res.status(500).json({ message: `❌ ${error.message}` });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { orderId, otp } = req.body;
    console.log(orderId, otp, "orderId,otp");

    const order = await findAnyOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (String(order.otp) !== String(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    console.log(order, "order");

    order.deliveryRiderStatus = "en_route_delivery";
    order.orderStatus = "in_transit";
    order.customerDeliveryStatus = "on_the_way";
    order.otp = null; // Clear OTP after use
    await order.save();
    emitOrderUpdate(req.io, orderId, order);

    // 📱 Rider notification: "OTP verified, head to customer"
    notifyOrderEvent("rider", "otp_verified", {
      riderId: req.riderId,
      orderId: order._id,
    });

    // 📱 Customer notification: "Rider on the way" (selective milestone — replaces rider_assigned)
    notifyOrderEvent("customer", "rider_arriving", {
      userId: order.userId,
      orderId: order._id,
    });

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.status(500).json({ message: "❌ " + error.message });
  }
}

export const reachedCustomerLocation = async (req, res) => {
  try {
    const { orderId, latitude, longitude } = req.body;
    console.log(req.body, "req.bodyhhhhhh");

    console.log(orderId, latitude, longitude, "orderId,latitude,longitude");

    const order = await findAnyOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    console.log(order, "ssssss");

    console.log(order.deliveryRiderId, req.riderId, "asdfasdf");

    if (order.deliveryRiderId?.toString() !== req.riderId.toString()) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    // Use real delivery location from order instead of hardcoded coords
    if (latitude != null && longitude != null && order.deliveryLocation?.coordinates?.length === 2) {
      const [custLng, custLat] = order.deliveryLocation.coordinates;
      const distance = getDistance(latitude, longitude, custLat, custLng);
      // Soft check — log but don't block (GPS can be inaccurate)
      if (distance > 500) {
        console.warn(`Rider ${distance.toFixed(0)}m from customer — may not be at location`);
      }
    }

    order.deliveryRiderStatus = "at_delivery";
    order.orderStatus = "in_transit";
    order.otp = Math.floor(1000 + Math.random() * 9000); // OTP for handover
    await order.save();
    emitOrderUpdate(req.io, orderId, order);

    // 📱 Customer notification: "Rider at your location"
    notifyOrderEvent("customer", "rider_reached_location", {
      userId: order.userId,
      orderId: order._id,
    });

    res.status(200).json({ message: "Rider confirmed at customer location" });
  } catch (error) {
    console.error("Error in reachedCustomerLocation:", error);
    res.status(500).json({ message: "❌ " + error.message });
  }
}

export const handOutProducts = async (req, res) => {
  const { orderId, otp } = req.body;
  try {
    const cleanOrderId = orderId ? String(orderId).replace(/^["']|["']$/g, '').trim() : '';
    const order = await findAnyOrderById(cleanOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.otp) !== String(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Update order status and set trial phase details
    order.orderStatus = "try_phase";
    order.deliveryRiderStatus = "try_phase";
    order.customerDeliveryStatus = "try_your_fits";
    order.trialPhaseStart = new Date(); // Set start time to current time
    order.trialPhaseEnd = null; // Reset end time
    order.trialPhaseDuration = 30; // Set trial phase duration (e.g., 30 minutes)
    //generate 4 digit otp
    const newOtp = Math.floor(1000 + Math.random() * 9000);
    order.otp = newOtp;
    await order.save();

    // Emit orderUpdate event
    emitOrderUpdate(req.io, cleanOrderId, order);

    // Emit trialPhaseStart event to the orderId room and customer user room
    const trialPayload = {
      orderId: cleanOrderId,
      trialPhaseStart: order.trialPhaseStart.toISOString(),
      trialPhaseDuration: order.trialPhaseDuration,
    };

    req.io.to(cleanOrderId).emit('trialPhaseStart', trialPayload);
    if (orderId && String(orderId) !== cleanOrderId) {
      req.io.to(String(orderId)).emit('trialPhaseStart', trialPayload);
    }
    const userId = order.userId?._id ? order.userId._id.toString() : order.userId?.toString();
    if (userId) {
      const cleanUserId = String(userId).replace(/^["']|["']$/g, '').trim();
      req.io.to(`user:${cleanUserId}`).emit('trialPhaseStart', trialPayload);
      req.io.to(cleanUserId).emit('trialPhaseStart', trialPayload);
    }

    return res.status(200).json({ message: "Order status updated" });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ message: "Error updating order status" });
  }
};
export const endTrialPhase = async (req, res) => {
  const { orderId, otp } = req.body;
  try {
    const cleanOrderId = orderId ? String(orderId).replace(/^["']|["']$/g, '').trim() : '';
    const order = await findAnyOrderById(cleanOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.orderStatus === "completed" || order.orderStatus === "cancelled") {
      return res.status(400).json({
        message: `Order is already ${order.orderStatus}`
      });
    }

    const validStatuses = ["try_phase", "selection_made", "in_transit", "return_in_progress"];
    const validRiderStatuses = ["try_phase", "at_delivery", "returning"];
    if (!validStatuses.includes(order.orderStatus) && !validRiderStatuses.includes(order.deliveryRiderStatus)) {
      return res.status(400).json({
        message: `Order is not in trial phase (current status: ${order.orderStatus}, rider status: ${order.deliveryRiderStatus})`
      });
    }

    if (!otp || String(order.otp) !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid OTP. Please enter the valid OTP from customer." });
    }

    // Record end time and compute actual duration
    const now = new Date();
    order.trialPhaseEnd = now;

    const startTime = order.trialPhaseStart ? new Date(order.trialPhaseStart) : now;
    const durationMs = now - startTime;
    const durationMinutes = Math.max(0, Math.floor(durationMs / (1000 * 60)));

    order.trialPhaseDuration = durationMinutes;

    // Overtime penalty: ₹2/min over 10 mins
    let overtimePenalty = 0;
    if (durationMinutes > 10) {
      overtimePenalty = (durationMinutes - 10) * 2;
    }
    order.overtimePenalty = overtimePenalty;

    // Recalculate billing with overtime penalty
    const billing = calculateFinalBilling({
      orderItems: order.items,
      deliveryCharge: order.deliveryCharge || 0,
      returnCharge: order.returnCharge || 0,
      deliveryTip: order.finalBilling?.deliveryTip || 0,
      trialPhaseStart: order.trialPhaseStart,
      trialPhaseEnd: order.trialPhaseEnd,
      discountToApply: order.finalBilling?.discount || 0,
    });

    order.finalBilling = {
      ...order.finalBilling,
      ...billing,
      overtimePenalty,
      totalPayable: billing.totalPayable,
    };

    // If orderStatus was already selection_made or returning, preserve it
    if (order.orderStatus === "try_phase") {
      order.deliveryRiderStatus = "try_phase";
      order.customerDeliveryStatus = "awaiting_payment";
    }

    // Clear OTP after successful verification so it cannot be reused
    order.otp = null;

    await order.save();

    const io = req.io || getIO();
    emitOrderUpdate(io, cleanOrderId, order);

    const trialEndedPayload = {
      orderId: cleanOrderId,
      trialPhaseEnd: order.trialPhaseEnd.toISOString(),
      trialPhaseDuration: durationMinutes,
      overtimePenalty,
      finalBilling: order.finalBilling,
      totalPayable: order.finalBilling?.totalPayable ?? 0,
      customerDeliveryStatus: order.customerDeliveryStatus,
    };

    // Emit trialPhaseEnded event to all relevant rooms
    io.to(cleanOrderId).emit('trialPhaseEnded', trialEndedPayload);
    if (orderId && orderId !== cleanOrderId) {
      io.to(orderId).emit('trialPhaseEnded', trialEndedPayload);
    }
    if (order._id && String(order._id) !== cleanOrderId) {
      io.to(String(order._id)).emit('trialPhaseEnded', trialEndedPayload);
    }

    return res.status(200).json({
      message: "Trial phase ended successfully. Amount calculated.",
      trialPhaseDurationMinutes: durationMinutes,
      overtimePenalty,
      finalBilling: order.finalBilling,
      order,
    });
  } catch (error) {
    console.error("Error ending trial phase:", error);
    return res.status(500).json({ message: "Error ending trial phase" });
  }
};

export const verifyOtpOnReturn = async (req, res) => {
  try {
    const { orderId, otp } = req.body;
    const cleanOrderId = orderId ? String(orderId).replace(/^["']|["']$/g, '').trim() : '';

    const order = await findAnyOrderById(cleanOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.otp) !== String(otp)) return res.status(400).json({ message: "Invalid OTP" });

    order.deliveryRiderStatus = "returning";
    order.orderStatus = "return_in_progress";
    order.customerDeliveryStatus = "completed";
    order.otp = null; // Clear OTP after use

    await order.save();
    emitOrderUpdate(req.io, cleanOrderId, order);

    // 📱 Rider notification: "Return verified, you're done!"
    notifyOrderEvent("rider", "return_complete", {
      riderId: req.riderId,
      orderId: order._id,
    });

    // 📱 Customer notification: "Order fully complete"
    notifyOrderEvent("customer", "delivery_complete", {
      userId: order.userId,
      orderId: order._id,
    });

    res.status(200).json({ message: "Return OTP verified. Order complete.", order });
  } catch (error) {
    console.error("Error in verifyOtpOnReturn:", error);
    res.status(500).json({ message: "❌ " + error.message });
  }
};

export const reachedReturnMerchant = async (req, res) => {
  try {
    const { orderId, latitude, longitude } = req.body; // Fixed: was 'latitue'

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await findAnyOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.deliveryRiderId?.toString() !== req.riderId.toString()) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    // Generate a return OTP for merchant to verify the return handover (preserve existing if already generated)
    if (!order.otp) {
      order.otp = Math.floor(1000 + Math.random() * 9000);
    }

    // Geo-check: only if coordinates are provided and merchant coords exist
    if (latitude != null && longitude != null && order.pickupLocation?.coordinates?.length === 2) {
      const [merchantLng, merchantLat] = order.pickupLocation.coordinates;
      const distance = getDistance(latitude, longitude, merchantLat, merchantLng);
      if (distance > 300) {
        return res.status(400).json({
          message: `Rider is ${Math.round(distance)}m from merchant — must be within 300m`,
          distanceMeters: Math.round(distance),
        });
      }
    }

    // Correct statuses for return arrival at merchant
    order.deliveryRiderStatus = "at_merchant_return";
    order.orderStatus = "return_in_progress";
    await order.save();

    emitOrderUpdate(req.io, orderId, order);
    // Clone the order and hide the OTP from the rider's HTTP response
    const safeOrder = order.toObject();
    delete safeOrder.otp;

    res.status(200).json({
      message: "Rider confirmed at merchant location for return",
      order: safeOrder,
    });
  } catch (error) {
    console.error("Error in reachedReturnMerchant:", error);
    res.status(500).json({ message: "❌ " + error.message });
  }
};

export const verifyMerchantReturnOtp= async (req, res) => {
  try {
    const { orderId, otp } = req.body;

    const order = await findAnyOrderById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.otp) !== String(otp)) return res.status(400).json({ message: "Invalid OTP" });

    order.deliveryRiderStatus = "completed";
    order.orderStatus = "completed";
    order.otp = null; // Clear OTP after use

    await order.save();
    emitOrderUpdate(req.io, orderId, order);

    // ✅ Free the rider in DB
    if (order.deliveryRiderId) {
      const deliveryRiderModel = (await import("../../models/deliveryRider.model.js")).default;
      await deliveryRiderModel.findByIdAndUpdate(order.deliveryRiderId, {
        currentOrderId: null,
        isBusy: false,
        isAvailable: true,
      });

      // ✅ Free rider from redis meta
      try {
        const { setRiderMeta, getRiderMeta } = await import("../../helperFns/deliveryRiderFns.js");
        const meta = await getRiderMeta(order.deliveryRiderId.toString());
        await setRiderMeta(order.deliveryRiderId.toString(), meta?.zoneId || 'global', {
          isBusy: "false",
          assignedOrderId: "",
        });
      } catch (redisErr) {
        console.error("Redis meta cleanup error (non-fatal):", redisErr);
      }

      // Associate this order with the rider's active online session
      try {
        await addOrderToSession(order.deliveryRiderId.toString(), order._id.toString());
      } catch (sessionErr) {
        console.error("Session order association error (non-fatal):", sessionErr);
      }
    }    // 📱 Rider notification: "Return verified, you're done!"
    notifyOrderEvent("rider", "return_complete", {
      riderId: req.riderId,
      orderId: order._id,
    });

    // 📱 Customer notification: "Order fully complete"
    notifyOrderEvent("customer", "delivery_complete", {
      userId: order.userId,
      orderId: order._id,
    });

    res.status(200).json({ message: "Return OTP verified. Order complete." });
  } catch (error) {
    console.error("Error in verifyOtpOnReturn:", error);
    res.status(500).json({ message: "❌ " + error.message });
  }
};

export const updateRiderLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const riderId = req.riderId;

    if (!riderId || lat == null || lng == null) {
      return res.status(400).json({ message: "riderId, lat, and lng are required" });
    }

    const currentMeta = await getRiderMeta(riderId.toString());
    const zoneId = await inferZone(lat, lng);

    let assignedOrderId = currentMeta?.assignedOrderId || "";
    if (!assignedOrderId) {
      const rider = await deliveryRiderModel.findById(riderId);
      if (rider?.currentOrderId) {
        assignedOrderId = rider.currentOrderId.toString();
      }
    }

    const newMeta = {
      isOnline: true,
      isBusy: !!assignedOrderId || currentMeta?.isBusy === "true" || currentMeta?.isBusy === true,
      socketId: currentMeta?.socketId || "",
      lastSeenAt: Date.now(),
      zoneId,
      assignedOrderId,
    };

    await setRiderMeta(riderId.toString(), zoneId, newMeta);

    // Put rider in Redis geo set if they are online and not busy
    if (!newMeta.isBusy && !newMeta.assignedOrderId) {
      await geoAdd(zoneId, lng, lat, riderId.toString());
    }

    await setHeartbeat(riderId.toString(), zoneId, 120);

    // Update online session heartbeat
    await heartbeatSession(riderId.toString());

    // Emit live updates to any socket rooms
    if (req.io) {
      if (!newMeta.isBusy && !newMeta.assignedOrderId) {
        req.io.emit(`riderAvailable:${zoneId}`, { zoneId, riderId: riderId.toString() });
      }

      const assignedOrderId = newMeta.assignedOrderId;
      if (assignedOrderId) {
        req.io.to(assignedOrderId).emit("riderLocationUpdate", {
          riderId: riderId.toString(),
          lat,
          lng,
          ts: Date.now(),
        });
      }
    }

    // Update location in MongoDB model for backup
    await deliveryRiderModel.findByIdAndUpdate(riderId, {
      location: {
        type: "Point",
        coordinates: [lng, lat],
        updatedAt: new Date()
      }
    });

    return res.status(200).json({ success: true, message: "Location updated successfully", zoneId });
  } catch (error) {
    console.error("Error in updateRiderLocation REST controller:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getActiveOrder = async (req, res) => {
  try {
    const riderId = req.riderId;
    const rider = await deliveryRiderModel.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Try finding by currentOrderId
    let order = null;
    if (rider.currentOrderId) {
      order = await findAnyOrderPopulated(rider.currentOrderId);
    }

    // Fallback: search for any active order assigned to this rider
    if (!order) {
      order = await Order.findOne({
        deliveryRiderId: riderId,
        orderStatus: { $nin: ["completed", "cancelled", "returned"] },
      }).populate("merchantId").populate('userId', 'name phoneNumber');

      if (!order) {
        order = await WarehouseOrder.findOne({
          deliveryRiderId: riderId,
          orderStatus: { $nin: ["completed", "cancelled", "returned"] },
        }).populate("warehouseId").populate("sourceMerchantId").populate('userId', 'name phoneNumber');
        if (order && !order.merchantId) {
          order.merchantId = {
            _id: order.warehouseId?._id || order.warehouseId,
            shopName: order.warehouseDetails?.name || order.warehouseId?.name || "Warehouse Hub",
            address: order.warehouseId?.address || order.pickupLocation,
            phone: order.warehouseId?.phone || order.merchantDetails?.phone || null,
          };
        }
      }
    }

    // Filter out completed/cancelled ones that might be stuck in currentOrderId
    if (order && ["completed", "cancelled", "returned"].includes(order.orderStatus)) {
      order = null;
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error in getActiveOrder:", error);
    return res.status(500).json({ message: "Error fetching active order" });
  }
};

/**
 * Rider confirms they collected the delivery fee directly from customer via QR.
 * This triggers settlement with riderPaidDirectly flag, so FlashFits doesn't double-pay.
 */
export const confirmQrCollection = async (req, res) => {
  try {
    const { orderId } = req.params;
    const riderId = req.riderId;

    const order = await findAnyOrderById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Validate rider is assigned to this order
    if (order.deliveryRiderId?.toString() !== riderId) {
      return res.status(403).json({ message: "You are not assigned to this order" });
    }

    // Validate delivery fee recovery is pending
    if (!order.deliveryFeeRecovery?.required || order.deliveryFeeRecovery?.status !== 'pending') {
      return res.status(400).json({ message: "No pending delivery fee recovery for this order" });
    }

    // Mark as collected via QR
    order.deliveryFeeRecovery.status = 'paid_via_qr';
    order.deliveryFeeRecovery.collectedByRider = true;
    order.deliveryFeeRecovery.paidAt = new Date();

    // Complete the order flow
    order.orderStatus = "selection_made";
    order.customerDeliveryStatus = "completed";
    order.deliveryRiderStatus = "returning";

    // Settle the order — settlement will see collectedByRider=true and skip rider payout
    try {
      const { settleOrder } = await import("../../helperFns/orderSettlement.js");
      await settleOrder(order);
    } catch (settleErr) {
      console.error("Settlement error (QR collection, non-fatal):", settleErr.message);
      order.settlementStatus = 'failed';
    }

    await order.save();

    // Emit real-time update to customer app
    const io = getIO();
    emitOrderUpdate(io, orderId, order);

    // Notify customer
    try {
      await notifyOrderEvent('customer', 'delivery_fee_collected', {
        userId: order.userId,
        orderId: order._id,
        amount: order.deliveryFeeRecovery?.amount,
      });
    } catch (e) {
      console.error("Notification error (non-fatal):", e);
    }

    return res.status(200).json({
      success: true,
      message: `Delivery fee ₹${order.deliveryFeeRecovery.amount} marked as collected via QR.`,
      order,
    });
  } catch (error) {
    console.error("Error in confirmQrCollection:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Rider reports that the customer refused to pay the delivery fee.
 * Admin will be notified. FlashFits absorbs the cost + customer gets a penalty.
 */
export const reportDeliveryFeeRefusal = async (req, res) => {
  try {
    const { orderId } = req.params;
    const riderId = req.riderId;

    const order = await findAnyOrderById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Validate rider is assigned to this order
    if (order.deliveryRiderId?.toString() !== riderId) {
      return res.status(403).json({ message: "You are not assigned to this order" });
    }

    if (!order.deliveryFeeRecovery?.required || order.deliveryFeeRecovery?.status !== 'pending') {
      return res.status(400).json({ message: "No pending delivery fee recovery for this order" });
    }

    // FlashFits absorbs the cost
    order.deliveryFeeRecovery.status = 'absorbed';
    order.orderStatus = "selection_made";
    order.customerDeliveryStatus = "completed";
    order.deliveryRiderStatus = "returning";

    // Settle normally — FlashFits pays rider since customer didn't pay
    try {
      const { settleOrder } = await import("../../helperFns/orderSettlement.js");
      await settleOrder(order);
    } catch (settleErr) {
      console.error("Settlement error (fee refusal, non-fatal):", settleErr.message);
      order.settlementStatus = 'failed';
    }

    await order.save();

    // Increment customer's penalty counter
    try {
      const User = (await import("../../models/user.model.js")).default;
      await User.findByIdAndUpdate(order.userId, { $inc: { deliveryFeePenalties: 1 } });
    } catch (e) {
      console.error("Error incrementing penalty (non-fatal):", e);
    }

    // Emit real-time update
    const ioReport = getIO();
    emitOrderUpdate(ioReport, orderId, order);

    // Notify admin
    try {
      const { notifyAdmin } = await import("../../helperFns/notificationHelper.js");
      await notifyAdmin({
        type: 'warning',
        title: '⚠️ Delivery Fee Refusal',
        body: `Customer refused to pay ₹${order.deliveryFeeRecovery.amount} delivery fee for order #${order._id.toString().slice(-5).toUpperCase()}. Cost absorbed by FlashFits. Customer penalty incremented.`,
        data: { orderId: order._id.toString() },
      });
    } catch (e) {
      console.error("Admin notification error (non-fatal):", e);
    }

    return res.status(200).json({
      success: true,
      message: "Delivery fee refusal reported. Admin will be notified.",
      order,
    });
  } catch (error) {
    console.error("Error in reportDeliveryFeeRefusal:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Rider confirms cash collected from customer for kept items / delivery fee / overtime.
 */
export const confirmCashCollection = async (req, res) => {
  try {
    const rawOrderId = req.params.orderId || req.body.orderId;
    const cleanOrderId = rawOrderId ? String(rawOrderId).replace(/^["']|["']$/g, '').trim() : '';
    const riderId = req.riderId;

    const order = await findAnyOrderById(cleanOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Validate rider is assigned to this order
    if (order.deliveryRiderId?.toString() !== riderId) {
      return res.status(403).json({ message: "You are not assigned to this order" });
    }

    // Mark payment status as paid
    order.paymentStatus = "paid";

    if (order.deliveryFeeRecovery?.required) {
      order.deliveryFeeRecovery.status = "paid_cash";
      order.deliveryFeeRecovery.collectedByRider = true;
      order.deliveryFeeRecovery.paidAt = new Date();
    }

    const hasReturns = (order.items || []).some((i) => i.tryStatus === "returned");

    order.orderStatus = hasReturns ? "return_in_progress" : "completed";
    order.customerDeliveryStatus = "completed";
    order.deliveryRiderStatus = hasReturns ? "returning" : "completed";

    // Run settlement
    try {
      const { settleOrder } = await import("../../helperFns/orderSettlement.js");
      await settleOrder(order);
    } catch (settleErr) {
      console.error("Settlement error (cash collection, non-fatal):", settleErr.message);
    }

    await order.save();

    const io = req.io || getIO();
    emitOrderUpdate(io, cleanOrderId, order);

    const cashCollectedPayload = {
      orderId: cleanOrderId,
      amountCollected: order.finalBilling?.totalPayable ?? order.totalAmount ?? 0,
      hasReturns,
      paymentStatus: 'paid',
      orderStatus: order.orderStatus,
      customerDeliveryStatus: order.customerDeliveryStatus,
    };

    io.to(cleanOrderId).emit('cashCollected', cashCollectedPayload);
    if (rawOrderId && rawOrderId !== cleanOrderId) {
      io.to(rawOrderId).emit('cashCollected', cashCollectedPayload);
    }
    if (order._id && String(order._id) !== cleanOrderId) {
      io.to(String(order._id)).emit('cashCollected', cashCollectedPayload);
    }

    return res.status(200).json({
      success: true,
      message: "Cash collection confirmed. Order marked as paid.",
      order,
      hasReturns,
    });
  } catch (error) {
    console.error("Error in confirmCashCollection:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
