import Order from "../../models/order.model.js";
import deliveryRiderModel from "../../models/deliveryRider.model.js";
import PendingOrder from "../../models/pendingOrders.model.js";
import { getRiderMeta, setRiderMeta } from "../../helperFns/deliveryRiderFns.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { notifyOrderEvent } from "../../helperFns/notificationHelper.js";
import { clearRiderTimeout } from "../../helperFns/riderTimeoutHelper.js";

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

    const order = await Order.findById(orderId)
      .populate('items.productId')
      .populate('merchantId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Prevent other riders from accepting
    if (order.deliveryRiderId && order.deliveryRiderId.toString() !== rider._id.toString()) {
      return res.status(403).json({ message: 'Order already assigned to another rider' });
    }

    // === CALCULATE DELIVERY CHARGE LOGIC ===
    let deliveryCharge = 0;

    // Check if any item is Try & Buy (has tryStatus field and not 'not-triable')
    const hasTryAndBuyItem = order.items.some(item =>
      item.tryStatus && item.tryStatus !== 'not-triable'
    );

    if (hasTryAndBuyItem) {
      // Try & Buy: One way delivery + return trip
      deliveryCharge = 15; // ₹10 (to customer) + ₹5 (return pickup)
    } else {
      // Regular delivery (one way only)
      deliveryCharge = 10; // ₹10 one way
    }

    // Optional: Add distance-based charge later (if deliveryDistance exists)
    // Example: deliveryCharge += order.deliveryDistance * 2; // ₹2 per km extra

    // Update order fields
    order.deliveryRiderId = rider._id;
    order.deliveryRiderStatus = 'assigned';
    order.deliveryCharge = deliveryCharge;

    // Save rider details
    order.deliveryRiderDetails = {
      name: rider.fullName,
      phone: rider.phone
    };

    // Update final billing 
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    order.finalBilling = {
      baseAmount: subtotal,
      tryAndBuyFee: hasTryAndBuyItem ? 50 : 0, // optional extra fee
      gst: Math.round(subtotal * 0.18), // 18% GST example
      discount: 0,
      deliveryCharge: deliveryCharge,

      totalPayable: subtotal +
        (hasTryAndBuyItem ? 50 : 0) +
        Math.round(subtotal * 0.18) +
        deliveryCharge
    };

    // Also update top-level deliveryCharge (for consistency)
    order.totalAmount = order.finalBilling.totalPayable;

    await order.save();

    // ⏰ Clear the 2-minute timeout — rider accepted in time
    clearRiderTimeout(orderId);

    // Update rider's current order
    rider.currentOrderId = orderId;
    await rider.save();

    // Emit real-time update
    emitOrderUpdate(req.io, orderId, order);

    return res.status(200).json({
      message: 'Order accepted successfully',
      order: {
        _id: order._id,
        deliveryCharge,
        totalAmount: order.totalAmount,
        finalBilling: order.finalBilling,
        hasTryAndBuyItem
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
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.deliveryRiderId?.toString() !== req.riderId.toString()) {
      console.log(order.deliveryRiderId?.toString(), req.riderId.toString());

      return res.status(403).json({ message: 'Not authorized for this order' });
    }
    const pickupLocation = {
      latitude: 9.9675883,
      longitude: 76.2984220
    };
    // if (!order.pickupLocation || !order.pickupLocation.latitude || !order.pickupLocation.longitude) {
    //   console.log(order.pickupLocation,order.pickupLocation.latitude,order.pickupLocation.longitude);

    //   return res.status(400).json({ message: 'Order pickup location not set' });
    // }

    // Calculate distance
    const distance = getDistance(
      latitude,
      longitude,
      pickupLocation.latitude,
      pickupLocation.longitude
    );

    // Check if within 50 meters
    // if (distance > 200) {
    //   return res.status(400).json({ 
    //     message: `Rider is ${distance.toFixed(2)} meters from pickup location, must be within 50 meters` 
    //   });
    // }

    // Update order status
    order.deliveryRiderStatus = 'arrived at pickup';
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

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    console.log(order, "order");

    order.deliveryRiderStatus = "en route to delivery";
    order.orderStatus = "out_for_delivery";
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

    const order = await Order.findById(orderId);
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

    order.deliveryRiderStatus = "arrived at delivery";
    order.orderStatus = "arrived at delivery";
    await order.save();
    emitOrderUpdate(req.io, orderId, order);

    res.status(200).json({ message: "Rider confirmed at customer location" });
  } catch (error) {
    console.error("Error in reachedCustomerLocation:", error);
    res.status(500).json({ message: "❌ " + error.message });
  }
}

export const handOutProducts = async (req, res) => {
  const { orderId } = req.body;
  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Update order status and set trial phase details
    order.orderStatus = "try phase";
    order.deliveryRiderStatus = "try phase";
    order.trialPhaseStart = new Date(); // Set start time to current time
    order.trialPhaseEnd = null; // Reset end time
    order.trialPhaseDuration = 30; // Set trial phase duration (e.g., 30 minutes)
    //generate 4 digit otp
    const otp = Math.floor(1000 + Math.random() * 9000);
    order.otp = otp;
    await order.save();

    // Emit orderUpdate event
    emitOrderUpdate(req.io, orderId, order);

    // Emit trialPhaseStart event to the orderId room
    req.io.to(orderId).emit('trialPhaseStart', {
      orderId,
      trialPhaseStart: order.trialPhaseStart.toISOString(),
      trialPhaseDuration: order.trialPhaseDuration,
    });

    return res.status(200).json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ message: "Error updating order status" });
  }
};
export const endTrialPhase = async (req, res) => {
  const { orderId } = req.body;
  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Fixed: status string uses space, not underscore
    if (order.orderStatus !== "try phase") {
      return res.status(400).json({
        message: `Order is not in trial phase (current: ${order.orderStatus})`
      });
    }

    // Record end time and compute actual duration
    const now = new Date();
    order.trialPhaseEnd = now;

    const startTime = new Date(order.trialPhaseStart);
    const durationMs = now - startTime;
    const durationMinutes = Math.max(0, Math.floor(durationMs / (1000 * 60)));

    order.trialPhaseDuration = durationMinutes;
    // The customer side decides items → sets actual final status
    // Rider just signals end of wait; customer app takes over selection
    order.deliveryRiderStatus = "waiting for customer selection";

    await order.save();
    emitOrderUpdate(req.io, orderId, order);

    return res.status(200).json({
      message: "Trial phase timer ended — awaiting customer item selection",
      trialPhaseDurationMinutes: durationMinutes,
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

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    order.deliveryRiderStatus = "otp-verified-return";
    order.orderStatus = "otp-verified-return";

    // Free the rider — return trip complete
    if (order.deliveryRiderId) {
      await deliveryRiderModel.findByIdAndUpdate(order.deliveryRiderId, {
        currentOrderId: null,
        isBusy: false,
        isAvailable: true,
      });
    }

    await order.save();
    emitOrderUpdate(req.io, orderId, order);

    // 📱 Rider notification: "Return verified, you're done!"
    notifyOrderEvent("rider", "return_complete", {
      riderId: req.riderId,
      orderId: order._id,
    });

    // 📱 Rider notification: earnings
    notifyOrderEvent("rider", "earnings_credited", {
      riderId: req.riderId,
      orderId: order._id,
      amount: order.deliveryCharge || 0,
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
}

export const reachedReturnMerchant = async (req, res) => {
  try {
    const { orderId, latitude, longitude } = req.body; // Fixed: was 'latitue'

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.deliveryRiderId?.toString() !== req.riderId.toString()) {
      return res.status(403).json({ message: "Not authorized for this order" });
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
    order.deliveryRiderStatus = "reached return merchant";
    order.orderStatus = "reached return merchant";
    await order.save();

    emitOrderUpdate(req.io, orderId, order);
    res.status(200).json({
      message: "Rider confirmed at merchant location for return",
      order,
    });
  } catch (error) {
    console.error("Error in reachedReturnMerchant:", error);
    res.status(500).json({ message: "❌ " + error.message });
  }
};