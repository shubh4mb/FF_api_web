import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
// controllers/orderController.js
import Cart from '../../models/cart.model.js';
import Delivery from '../../models/deliveryRider.model.js';
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import {notifyMerchant} from "../../sockets/merchant.socket.js";
import Razorpay from "../../config/RazorPay..js";
import { io } from "../../../index.js"

// export const createOrder = async (req, res) => {
//   try {
//     const userId = req.user.userId;

//     // 1. Get user's cart
//     const cart = await Cart.findOne({ userId });
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({ error: 'Cart is empty' });
//     }

//     // 2. Generate order items and calculate total
//     let totalAmount = 0;
//     const orderItems = [];

//     for (let item of cart.items) {
//       // Optional: You can fetch product price from DB
//       // const product = await Product.findById(item.productId);
//       // const variant = product.variants.id(item.variantId);
//       // const price = variant.price;

//       const price = 100; // TODO: replace with actual price from DB or cart item

//       orderItems.push({
//         productId: item.productId,
//         variantId: item.variantId,
//         image: item.image,
//         size: item.size,
//         quantity: item.quantity,
//         price: price,
//         merchantId: item.merchantId,
//       });

//       totalAmount += price * item.quantity;
//     }

//     // 3. Create order document
//     const newOrder = new Order({
//       userId,
//       items: orderItems,
//       totalAmount,
//       status: 'placed',
//       paymentStatus: 'pending' // or 'paid' if using fake payment
//     });

//     await newOrder.save();

//     // 4. Clear cart (optional)
//     cart.items = [];
//     await cart.save();

//     return res.status(201).json({ message: 'Order placed successfully', order: newOrder });

//   } catch (error) {
//     console.error("Order creation error:", error);
//     return res.status(500).json({ error: 'Something went wrong while placing the order' });
//   }
// };

export const createOrder = async (req, res) => {
  console.log(req.body.deliveryCharge, 'body');
  let amount = req.body.deliveryCharge;
  

  try {
    // Create Razorpay order
    // const razorpayOrder = await Razorpay.orders.create({
    //   amount,
    //   currency: "INR",
    //   receipt: `order_${Date.now()}`,
    // });
console.log("working");

    const userId = req.user.userId;

    // Step 1: Get user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    // Step 2: All items are from the same merchant
    const merchantId = cart.items[0].merchantId;

    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      const variant = product.variants.id(item.variantId);
      if (!variant) continue;

      const price = variant.price;
      const name = product.name;
      const image = item.image?.url || variant.images?.[0]?.url || '';

      totalAmount += price * item.quantity;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId,
        name,
        quantity: item.quantity,
        price,
        size: item.size,
        image,
        tryStatus: product.isTriable ? 'pending' : 'not-triable'
      });
    }
console.log("working2");

    // Step 3: Create order
    const newOrder = new Order({
      userId,
      merchantId,
      items: orderItems,
      totalAmount,
      finalBilling: {
        baseAmount: totalAmount,
        tryAndBuyFee: 0,
        gst: 0,
        discount: 0,
        deliveryCharge: 0,
        totalPayable: totalAmount,
      },
      deliveryLocation: {
        address: "",
        coordinates: []
      }
    });

    await newOrder.save();

    // Join customer socket to orderId room
    // const userSocketIds = onlineUsers[userId?.toString()];
    // if (userSocketIds && userSocketIds.length > 0) {
    //   userSocketIds.forEach((socketId) => {
    //     const socket = io.sockets.sockets.get(socketId);
    //     if (socket) {
    //       socket.join(order._id.toString());
    //       console.log(`User socket ${socketId} joined room ${order._id}`);
    //     } else {
    //       console.warn(`Socket ${socketId} not found for user ${userId}`);
    //     }
    //   });
    // } else {
    //   console.log(`No active sockets for user ${userId}`);
    // }

    // Step 4: Clear cart
    // await Cart.updateOne({ userId }, { $set: { items: [] } });

    // Step 5: Notify merchant
    notifyMerchant(io, newOrder.merchantId, newOrder);
console.log("working3");

    return res.status(201).json({
      message: 'Order placed successfully',
      order: newOrder,
      // razorpayOrder,
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// export const orderRequestForMerchant = async (req, res) => {
//   console.log("orderRequestForMerchant");
//   const { orderId } = req.params;
//   const { status } = req.body;
//   console.log(orderId,'orderId');
//   console.log(req.body);
  
  
//   console.log(status,'statussss');
  

//   const order = await Order.findById(orderId);
//   if (!order) return res.status(404).json({ message: "Order not found" });
  
//   order[0].orderStatus = status;
//   if(status=="accept"){
//     const deliveryBoy = await Delivery.findOne({status:"active"})
//     if(!deliveryBoy){
//       return res.status(404).json({ message: "Delivery boy not found" });
//     }
//     order.deliveryBoyId = deliveryBoy._id;
//     order.deliveryBoyStatus = "assigned";    
//   }
  
//   await order.save();

//   emitOrderUpdate(io, orderId, { status });


  
//   return res.status(200).json({ message: "Order status updated", orderId });
// };

export const orderRequestForDeliveryBoy = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action, deliveryBoyId } = req.body; // action: 'accept' | 'reject'

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // if (order.deliveryBoy && order.deliveryBoy.toString() !== deliveryBoyId) {
    //   return res.status(400).json({ message: "This order is already assigned to another delivery boy" });
    // }

    if (action === "accept") {
      // Assign delivery boy
      order.deliveryBoy = deliveryBoyId;
      order.deliveryBoyStatus = "assigned";

      // Update delivery boy’s availability
      await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, { status: "busy" });

      await order.save();
      return res.status(200).json({
        message: "Order accepted and assigned to delivery boy",
        order,
      });
    }

    if (action === "reject") {
      order.deliveryBoyStatus = "rejected";
      await order.save();
      return res.status(200).json({
        message: "Order rejected by delivery boy",
        order,
      });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const orderPacked = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.status="packed"
  await order.save();
  return res.status(200).json({ message: "Order packed", order });
};

export const reachedPickupLocation = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "arrived at pickup";
  await order.save();
  return res.status(200).json({ message: "Delivery boy reached pickup location", order });
};

export const orderPickedUp = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "picked & verified order";
  order.orderStatus = "out_for_delivery";
  await order.save();
  return res.status(200).json({ message: "Order picked up", order });
};

export const reachedDeliveryLocation = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "arrived at delivery";
  order.orderStatus = "arrived at delivery";
  await order.save();
  return res.status(200).json({ message: "Delivery boy reached delivery location", order });
};

export const handoverOrder = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "try phase";
  order.orderStatus = "try phase";
  await order.save();
  return res.status(200).json({ message: "Order handover", order });
};


export const getOrderForMerchant = async (req, res) => {
  const orders = await Order.find({ merchantId: req.merchant.merchantId });
  return res.status(200).json({ orders });
};

export const getOrderForDeliveryBoy = async (req, res) => {
  const { deliveryBoyId } = req.params;

  const orders = await Order.find({ deliveryBoyId });
  return res.status(200).json({ orders });
};

export const getOrderForUser = async (req, res) => {
  const { userId } = req.params;

  const orders = await Order.find({ userId });
  return res.status(200).json({ orders });
};

export const getAllOrders = async(req,res)=>{
  try {
    console.log(req.user);
    
    const userId = req.user.userId
    const orders = await Order.find({userId})
    return res.status(200).json({orders})
  } catch (error) {
    
  }
}

export const initiateReturn = async (req, res) => {
  try {
    console.log("initiateReturn");
    let { orderId } = req.params;
     orderId = orderId.replace(/^["']|["']$/g, '');
    console.log(orderId);

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryRiderStatus = "completed try phase";
  order.orderStatus = "completed try phase";
  await order.save();
  emitOrderUpdate(io, orderId, order);
  return res.status(200).json({ message: "Order handover", order });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};












