import Order from "../../models/order.model.js";
import deliveryRiderModel from "../../models/deliveryRider.model.js";
// import {redisPub} from "../../config/redisConfig.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";

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
    console.log(orderId,"orderId in accept order");
    
    const rider = await deliveryRiderModel.findById(req.riderId);
    // console.log(rider,"rider in accept order");
    
    if (!rider) {
      console.log("Rider not found");
      return res.status(404).json({ message: 'Rider not found' });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.riderId && order.riderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to accept this order' });
    }

    order.deliveryRiderStatus = 'assigned';
    order.deliveryRiderId = rider._id;
    await order.save();

    // const socketId = await redisPub.hGet(`rider:${rider._id}`, 'socketId');
    // if (socketId) {
    //   const socket = req.io.sockets.sockets.get(socketId);
    //   if (socket) {
    //     socket.emit("joinOrderRoom", orderId);
    //     console.log(`Rider ${rider._id} joined room ${orderId}`);
    //   } else {
    //     console.warn(`Rider ${rider._id} socket ${socketId} not connected`);
    //   }
    // } else {
    //   console.warn(`No socketId found for rider ${rider._id}`);
    // }

    emitOrderUpdate(req.io, orderId, order);

    res.status(200).json({ message: 'Order accepted successfully' });
  } catch (error) {
    console.error('Error in acceptOrder:', error);
    res.status(500).json({ message: `❌ ${error.message}` });
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
      console.log(order.deliveryRiderId?.toString(),req.riderId.toString());
      
      return res.status(403).json({ message: 'Not authorized for this order' });
    }
    const pickupLocation={
      latitude:9.9675883,
      longitude:76.2984220
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
    if (distance > 200) {
      return res.status(400).json({ 
        message: `Rider is ${distance.toFixed(2)} meters from pickup location, must be within 50 meters` 
      });
    }

    // Update order status
    order.deliveryRiderStatus = 'arrived at pickup';
    await order.save();

    // Emit order update
    emitOrderUpdate(req.io, orderId, order);


    res.status(200).json({ message: 'Rider confirmed at pickup location' });
  } catch (error) {
    console.error('Error in reachedPickupLocation:', error);
    res.status(500).json({ message: `❌ ${error.message}` });
  }
};

export const verifyOtp = async (req,res)=>{
    try {
        const {orderId,otp}=req.body;
        // console.log(orderId,otp,"orderId,otp");
        
        const order=await Order.findById(orderId);
        if(!order){
            return res.status(404).json({message:"Order not found"});
        }
        if(order.otp!==otp){
            return res.status(400).json({message:"Invalid OTP"});
        }
        console.log(order,"order");
        
        order.deliveryRiderStatus="en route to delivery";
        order.orderStatus="out_for_delivery";
        await order.save();
        emitOrderUpdate(req.io,orderId,order)
        res.status(200).json({message:"OTP verified successfully"});
    } catch (error) {
        console.error("Error in verifyOtp:",error);
        res.status(500).json({message:"❌ " + error.message});
    }
}

export const reachedCustomerLocation= async(req,res)=>{
  try {
    const {orderId,latitude,longitude}=req.body;
    console.log(req.body,"req.body");
    
    console.log(orderId,latitude,longitude,"orderId,latitude,longitude");
    
    const order=await Order.findById(orderId);
    if(!order){
      return res.status(404).json({message:"Order not found"});
    }
    if(order.deliveryRiderId?.toString()!==req.riderId.toString()){
      return res.status(403).json({message:"Not authorized for this order"});
    }
    const customerLocation={
      latitude:9.9675883,
      longitude:76.2984220
    };
    const distance=getDistance(latitude,longitude,customerLocation.latitude,customerLocation.longitude);
    if(distance>200){
      return res.status(400).json({message:"Rider is ${distance.toFixed(2)} meters from customer location, must be within 50 meters"});
    }
    order.deliveryRiderStatus="arrived at delivery";
    order.orderStatus="arrived at delivery";
    
    await order.save();
    emitOrderUpdate(req.io,orderId,order)
    res.status(200).json({message:"Rider confirmed at customer location"});
  } catch (error) {
    console.error("Error in reachedCustomerLocation:",error);
    res.status(500).json({message:"❌ " + error.message});
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
    const otp=Math.floor(1000 + Math.random() * 9000);
    order.otp=otp;
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
  const { orderId } = req.params;
  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.orderStatus !== "try_phase" || order.deliveryRiderStatus !== "try_phase") {
      return res.status(400).json({ message: "Order is not in trial phase" });
    }

    // Set trial phase end time
    order.trialPhaseEnd = new Date();

    // Calculate duration in minutes
    const startTime = new Date(order.trialPhaseStart);
    const endTime = new Date(order.trialPhaseEnd);
    const durationMs = endTime - startTime; // Difference in milliseconds
    const durationMinutes = Math.floor(durationMs / (1000 * 60)); // Convert to minutes

    // Update order with duration and new status
    order.trialPhaseDuration = durationMinutes;
    order.orderStatus = "completed"; // Or another status after trial phase
    order.deliveryRiderStatus = "completed"; // Adjust as needed

    await order.save();
    emitOrderUpdate(req.io, orderId, order);

    return res.status(200).json({
      message: "Trial phase ended",
      trialPhaseDuration: durationMinutes,
      order,
    });
  } catch (error) {
    console.error("Error ending trial phase:", error);
    return res.status(500).json({ message: "Error ending trial phase" });
  }
};

export const verifyOtpOnReturn=async(req,res)=>{
  try {
    const {orderId,otp}=req.body;
    console.log(orderId,otp,"orderId,otp");
    
    const order=await Order.findById(orderId);
    if(!order){
      return res.status(404).json({message:"Order not found"});
    }
    if(order.otp!==otp){
      return res.status(400).json({message:"Invalid OTP"});
    }
    console.log(order,"order");
    
    order.deliveryRiderStatus="otp-verified-return";
    
    const pickupCoordinates={
      latitude:9.9675883,
      longitude:76.2984220
    }
    await order.save();
    emitOrderUpdate(req.io,orderId,{order,pickupCoordinates})
    res.status(200).json({message:"OTP verified successfully"});
  } catch (error) {
    console.error("Error in verifyOtpOnReturn:",error);
    res.status(500).json({message:"❌ " + error.message});
  }
} 

export const reachedReturnMerchant = async(req,res)=>{
  try {
    const {orderId,latitue,longitude}=req.body;
    console.log(req.body,"req.body");
    const order =await Order.findById(orderId);
    if(!order){
      return res.status(404).json({message:"Order not found"});
    }
    if(order.deliveryRiderId?.toString()!==req.riderId.toString()){
      return res.status(403).json({message:"Not authorized for this order"});
    }
    const merchantLocation={
      latitude:9.9675883,
      longitude:76.2984220
    }
    const distance=getDistance(latitue,longitude,merchantLocation.latitude,merchantLocation.longitude);
    if(distance>200){
      return res.status(400).json({message:"Rider is ${distance.toFixed(2)} meters from merchant location, must be within 50 meters"});
    }
    order.deliveryRiderStatus="en route to return";
    order.orderStatus="en route to return";
    await order.save();
    emitOrderUpdate(req.io,orderId,order)
    res.status(200).json({message:"Rider confirmed at merchant location"});
    
  } catch (error) {
    console.error("Error in reachedReturnMerchant:",error);
    res.status(500).json({message:"❌ " + error.message});
  }
}