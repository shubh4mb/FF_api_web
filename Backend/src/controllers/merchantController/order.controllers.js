import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import {emitOrderUpdate} from "../../sockets/order.socket.js";
import { io } from "../../../index.js"
import DeliveryRider from "../../models/deliveryRider.model.js";
import {assignNearestRider} from "../../helperFns/deliveryRiderFns.js"
import {onlineMerchants} from "../../sockets/merchant.socket.js"

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000);
}

export const saveProductDetails = async (req, res) => {
  try {
    const { name, description } = req.body;
    const productId = req.params.id;

    // Validate that at least one field is provided
    if (!name && !description) {
      return res.status(400).json({ 
        message: 'At least one of name or description is required' 
      });
    }

    // Validate name if provided
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({ 
        message: 'Product name cannot be empty' 
      });
    }

    // Build update object dynamically
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description;

    // Find and update product
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, isActive: true },
      updateFields,
      { new: true, runValidators: true }
    )
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .populate('merchantId', 'name');

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found or inactive' });
    }

    res.status(200).json({
      message: '✅ Product details updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};



export const getPlacedOrder = async (req, res) => {
  console.log(req.merchantId,'merchantId');
  const orders = await Order.find({ merchantId: req.merchantId, orderStatus: "placed" });
  return res.status(200).json({ orders });
};



export const orderRequestForMerchant = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId).populate('merchantId', 'shopName');
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (status === "accept") {
      order.orderStatus = "accepted";
      const pickupLocation = {
  lat: 9.9371151,
  lng: 76.3244129,
};
      const customerLocation={
  lat: 9.9371151,
  lng: 76.3244129,
}
      let deliveryAmount= "100";
      const orderPayload = {
       ...order,
       pickupLocation,
       customerLocation,
       deliveryAmount,
      };



      const assigned = await assignNearestRider(pickupLocation, orderId, orderPayload);
      console.log("Assigned rider:", assigned);

      if (assigned) {
        // order.deliveryRiderId = assigned.riderId;
        order.deliveryDistance = assigned.distKm;
        // order.deliveryRiderStatus = "assigned";
        console.log(`✅ Rider ${assigned.riderId} assigned for order ${order._id}`);
      } else {
        console.log("❌ No available rider found within range");
        order.deliveryRiderStatus = "unassigned";
      }

      // Fix: Use Socket instance for join
      const merchantSocketIds = onlineMerchants[order.merchantId?.toString()];
      if (merchantSocketIds && merchantSocketIds.length > 0) {
        merchantSocketIds.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.join(orderId); // Correct way to join a room
            console.log(`Merchant socket ${socketId} joined room ${orderId}`);
            io.to(socketId).emit("orderUpdate", {
              orderId,
              orderStatus: order.orderStatus,
              deliveryRiderStatus: order.deliveryRiderStatus,
              merchantId: order.merchantId,
            });
            console.log(`📦 Emitted orderUpdate to merchant socket ${socketId}`);
          } else {
            console.warn(`Socket ${socketId} not found for merchant ${order.merchantId}`);
          }
        });
      } else {
        console.log(`No active sockets for merchant ${order.merchantId}`);
      }

      // Emit to orderId room for other roles
      io.to(orderId).emit("orderUpdate", {
        orderId,
        orderStatus: order.orderStatus,
        deliveryRiderStatus: order.deliveryRiderStatus,
        merchantId: order.merchantId,
      });
      console.log(`Emitted order update to room ${orderId}`);
    }

    if (status === "reject") {
      order.orderStatus = "rejected";
      order.reason = req.body.reason || "Merchant rejected the order";
    }

    await order.save();

    emitOrderUpdate(io, orderId, order);

    return res.status(200).json({
      message: "Order status updated",
      orderId,
      order,
    });
  } catch (err) {
    console.error("Error in orderRequestForMerchant:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllOrder = async (req, res) => {
    try {
      const orders = await Order.find({ merchantId: req.merchantId }).sort({ createdAt: -1 });
      console.log(orders.length,'orders length');
      
      return res.status(200).json({ orders });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching orders" });
    }
}

export const orderPacked = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.orderStatus = "packed";
    order.otp=generateOTP();
    await order.save();
    emitOrderUpdate(io, orderId, order);

    return res.status(200).json({ message: "Order status updated", order });

  } catch (error) {
    return res.status(500).json({ message: "Error updating order status" });
  }
}









