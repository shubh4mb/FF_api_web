import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
// controllers/orderController.js
import Cart from '../../models/cart.model.js';
import Delivery from '../../models/deliveryRider.model.js';
import Merchant from '../../models/merchant.model.js';
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import {notifyMerchant} from "../../sockets/merchant.socket.js";
import Razorpay from "../../config/RazorPay.js";
import Address from "../../models/address.model.js";
import { io } from "../../../index.js"
import {calculateDeliveryCharge} from "../../helperFns/deliveryChargeFns.js";
import razorpay from '../../config/RazorPay.js'
import crypto from 'crypto';
import { calculateFinalBilling } from "../../helperFns/calculateFinalBilling.js";

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

// export const createOrder = async (req, res) => {
//   // console.log(req.body.deliveryCharge, 'body');
//   // let amount = req.body.deliveryCharge;
//   let amount = 100;
  

//   try {
//     // Create Razorpay order
//     // const razorpayOrder = await Razorpay.orders.create({
//     //   amount,
//     //   currency: "INR",
//     //   receipt: `order_${Date.now()}`,
//     // });
// console.log("working");

//     const userId = req.user.userId;

//     // Step 1: Get user's cart
//     const cart = await Cart.findOne({ userId });
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({ message: 'Your cart is empty' });
//     }

//     // Step 2: All items are from the same merchant
//     const merchantId = cart.items[0].merchantId;

//     // Step 2.1: Get merchant coordinates for pickup
//     const merchant = await Merchant.findById(merchantId);
//     if (!merchant) {
//       return res.status(404).json({ message: 'Merchant not found' });
//     }

//     const merchantCoordinates = merchant.address?.location?.coordinates || [];

//     // Step 2.2: Get customer's selected delivery address from request body
//     const { addressId } = req.body;
//     if (!addressId) {
//       return res.status(400).json({ message: 'Address ID is required' });
//     }

//     // Fetch address details from address schema
    
//     const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
//     if (!deliveryAddress) {
//       return res.status(404).json({ message: 'Address not found' });
//     }
//     console.log("working2");

//     let totalAmount = 0;
//     const orderItems = [];

//     for (const item of cart.items) {
//       const product = await Product.findById(item.productId);
//       if (!product) continue;

//       const variant = product.variants.id(item.variantId);
//       if (!variant) continue;

//       const price = variant.price;
//       const name = product.name;
//       const image = item.image?.url || variant.images?.[0]?.url || '';

//       totalAmount += price * item.quantity;

//       orderItems.push({
//         productId: item.productId,
//         variantId: item.variantId,
//         name,
//         quantity: item.quantity,
//         price,
//         size: item.size,
//         image,
//         tryStatus: product.isTriable ? 'pending' : 'not-triable'
//       });
//     }

//     // Step 3: Create order
//     const newOrder = new Order({
//       userId,
//       merchantId,
//       items: orderItems,
//       totalAmount,
//       finalBilling: {
//         baseAmount: totalAmount,
//         tryAndBuyFee: 0,
//         gst: 0,
//         discount: 0,
//         deliveryCharge: req.body.deliveryCharge || 0,
//         totalPayable: totalAmount + (req.body.deliveryCharge || 0),
//       },
//       deliveryLocation: {
//         name: deliveryAddress.name,
//         phone: deliveryAddress.phone,
//         addressLine1: deliveryAddress.addressLine1,
//         addressLine2: deliveryAddress.addressLine2,
//         landmark: deliveryAddress.landmark,
//         area: deliveryAddress.area,
//         city: deliveryAddress.city,
//         state: deliveryAddress.state,
//         pincode: deliveryAddress.pincode,
//         country: deliveryAddress.country,
//         addressType: deliveryAddress.addressType,
//         deliveryInstructions: deliveryAddress.deliveryInstructions,
//         coordinates: deliveryAddress.location.coordinates // Customer's delivery coordinates [lng, lat]
//       },
//       // Store merchant coordinates separately for pickup location
//       pickupLocation: {
//         coordinates: merchantCoordinates // Merchant coordinates [lng, lat]
//       }
//     });

//     await newOrder.save();

//     // Join customer socket to orderId room
//     // const userSocketIds = onlineUsers[userId?.toString()];
//     // if (userSocketIds && userSocketIds.length > 0) {
//     //   userSocketIds.forEach((socketId) => {
//     //     const socket = io.sockets.sockets.get(socketId);
//     //     if (socket) {
//     //       socket.join(order._id.toString());
//     //       console.log(`User socket ${socketId} joined room ${order._id}`);
//     //     } else {
//     //       console.warn(`Socket ${socketId} not found for user ${userId}`);
//     //     }
//     //   });
//     // } else {
//     //   console.log(`No active sockets for user ${userId}`);
//     // }

//     // Step 4: Clear cart
//     // await Cart.updateOne({ userId }, { $set: { items: [] } });

//     // Step 5: Notify merchant
//     notifyMerchant(io, newOrder.merchantId, newOrder);
// console.log("working3");

//     return res.status(201).json({
//       message: 'Order placed successfully',
//       order: newOrder,
//       // razorpayOrder,
//     });

//   } catch (error) {
//     console.error('Create Order Error:', error);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

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

// 1. Create Razorpay Order + Pending Order in DB
export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { addressId } = req.body;

    // === VALIDATE CART ===
    const cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .populate("items.merchantId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    // === VALIDATE ADDRESS ===
    const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
    if (!deliveryAddress) {
      return res.status(404).json({ message: "Delivery address not found" });
    }

    const userCoords = deliveryAddress.location.coordinates;

    // === FETCH MERCHANT (SINGLE SHOP CART FOR NOW) ===
    const merchantId = cart.items[0].merchantId;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    const merchantCoords = merchant.address.location.coordinates;

    // === DELIVERY CHARGE USING HELPER ===
    const { distanceKm, deliveryCharge, estimatedTime } = calculateDeliveryCharge(
      userCoords,
      merchantCoords
    );

    // === CALCULATE RETURN CHARGE ===
    const returnCharge = Math.round(distanceKm * 7.5);

    // === CALCULATE TOTAL ===
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.productId;
      if (!product) continue;

      const variant = product.variants.id(item.variantId);
      if (!variant) continue;

      const price = variant.price;
      totalAmount += price * item.quantity;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId,
        name: product.name,
        quantity: item.quantity,
        price,
        size: item.size,
        image: item.image?.url || "",
        tryStatus: product.isTriable ? "pending" : "not-triable",
      });
    }

    // === FINAL PAYABLE ===
    const finalPayable = totalAmount + deliveryCharge;

    // === RAZORPAY ORDER ===
    const razorpayOrder = await razorpay.orders.create({
      amount: deliveryCharge * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    });

    // === SAVE ORDER IN DB ===
    const pendingOrder = new Order({
      userId,
      merchantId,
      merchantDetails: {
        name: merchant.name,
        phone: merchant.phone,
      },
      items: orderItems,
      totalAmount,
      finalBilling: {
        baseAmount: totalAmount,
        tryAndBuyFee: 0,
        gst: 0,
        discount: 0,
        deliveryCharge,
        totalPayable: finalPayable,
      },
      deliveryDistance: distanceKm,
      deliveryCharge,
      returnCharge,
      estimatedTime,
      deliveryLocation: {
        name: deliveryAddress.name,
        phone: deliveryAddress.phone,
        addressLine1: deliveryAddress.addressLine1,
        addressLine2: deliveryAddress.addressLine2,
        landmark: deliveryAddress.landmark,
        area: deliveryAddress.area,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        pincode: deliveryAddress.pincode,
        country: deliveryAddress.country,
        addressType: deliveryAddress.addressType,
        deliveryInstructions: deliveryAddress.deliveryInstructions,
        coordinates: deliveryAddress.location.coordinates,
      },
      pickupLocation: {
        coordinates: merchant.address.location.coordinates,
      },
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: "pending",
      status: "payment_pending",
    });

    await pendingOrder.save();

    // === RESPONSE ===
    return res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: deliveryCharge * 100,
      key_id: process.env.RAZORPAY_KEY_ID,
      orderId: pendingOrder._id,
      deliveryCharge,
      deliveryDistance: distanceKm,
      estimatedTime,
      contact: deliveryAddress.phone,
      name: deliveryAddress.name,
      email: req.user.email || "customer@example.com",
    });

  } catch (error) {
    console.error("Create Razorpay Order Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// 2. Verify Payment & Confirm Order
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId // your internal pending order ID
    } = req.body;

    // === STEP 1: Verify Signature ===
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // === STEP 2: Payment is Genuine → Confirm Order ===
    const order = await Order.findById(orderId);
    if (!order || order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: 'Order not found' });
    }

    // Update order
    order.razorpayPaymentId = razorpay_payment_id;
    // order.paymentStatus = 'paid';
    order.status = 'confirmed';
    await order.save();

    // === Clear user's cart ===
    // await Cart.updateOne({ userId: req.user.userId }, { $set: { items: [] } });

    // === Notify merchant (your existing function) ===
    notifyMerchant(io, order.merchantId, order); // assuming io is available or pass via req

    return res.status(200).json({
      success: true,
      message: 'Payment verified & order confirmed',
      orderId: order._id
    });

  } catch (error) {
    console.error('Verify Payment Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 3. Webhook Handler (Highly Recommended)
// Updated secure webhook
// Keep your existing webhook, just add condition for final payment
export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest !== signature) {
    return res.status(400).json({ message: "Invalid signature" });
  }

  const event = req.body.event;
  const payment = req.body.payload.payment?.entity;

  if (event === "payment.captured" && payment) {
    const order = await Order.findOne({ razorpayOrderId: payment.order_id });
    if (order) {
      order.razorpayPaymentId = payment.id;
      order.paymentStatus = "paid";

      // Detect if this was final payment (has finalBilling.totalPayable > deliveryCharge)
      if (order.finalBilling?.totalPayable > order.deliveryCharge) {
        order.orderStatus = "confirmed_purchase";
        order.customerDeliveryStatus = "completed";
      } else {
        order.orderStatus = "placed"; // advance payment
      }
      await order.save();
    }
  }

  res.status(200).json({ status: "ok" });
};

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
    console.log(orderId,'676777');
    
    orderId = orderId.replace(/^["']|["']$/g, '').trim();
    console.log(orderId,'676777');
    
    const { items } = req.body; // Expected payload: array of { itemId, tryStatus: "keep"|"return", returnReason }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array with tryStatus is required" });
    }

    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate that all itemIds exist in the order
    const orderItemIds = order.items.map(item => item._id.toString());
    const invalidItem = items.find(
      item => !orderItemIds.includes(item.itemId.toString())
    );
    if (invalidItem) {
      return res.status(400).json({ message: `Item with id ${invalidItem.itemId} not found in order` });
    }

    let keptItemsCount = 0;
    let returnedItemsCount = 0;
    let baseAmount = 0;

    // Process each item from payload
    for (const payloadItem of items) {
      const orderItem = order.items.id(payloadItem.itemId);

      if (!orderItem) continue;

      if (payloadItem.tryStatus === "keep") {
        orderItem.tryStatus = "accepted"; // User decided to keep
        orderItem.returnReason = null;
        keptItemsCount++;
        baseAmount += orderItem.price * orderItem.quantity;
      } else if (payloadItem.tryStatus === "return") {
        orderItem.tryStatus = "returned";
        orderItem.returnReason = payloadItem.returnReason || "Not liked"; // optional reason
        returnedItemsCount++;
      }
    }

    // Update final billing only for kept ("accepted") items
    order.finalBilling.baseAmount = baseAmount;
    order.finalBilling.totalPayable = baseAmount; // You can add fee/GST later if needed
    // Optionally add tryAndBuyFee, GST, etc. here if applicable

    // Determine final order status
    if (returnedItemsCount === order.items.length) {
      order.orderStatus = "returned";
    order.customerDeliveryStatus="completed";
      
      order.deliveryRiderStatus = "completed try phase"; // Rider will pick up all
    } else if (keptItemsCount === order.items.length) {
      order.orderStatus = "confirmed_purchase";
      order.deliveryRiderStatus = "confirmed purchase";
    order.customerDeliveryStatus="trial_phase_ended"

    } else {
      order.orderStatus = "partially_returned";
    }

    // Mark try phase as completed
    order.trialPhaseEnd = new Date();
    await order.save();
    // Emit real-time update (assuming you have socket.io set up)
    emitOrderUpdate(io, orderId, order);

    return res.status(200).json({
      message: "Try phase completed successfully",
      order,
      summary: {
        kept: keptItemsCount,
        returned: returnedItemsCount,
        finalAmount: order.finalBilling.totalPayable
      }
    });

  } catch (error) {
    console.error("Error in initiateReturn:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    // Clean orderId by removing extra quotes if present
    const cleanOrderId = orderId.replace(/^"|"$/g, '');
    const order = await Order.findById(cleanOrderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.status(200).json({ order });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createFinalPaymentRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array with tryStatus is required" });
    }

    const order = await Order.findOne({ _id: orderId, userId })
      .populate("items.productId")
      .populate("merchantId");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // === STEP 1: Update item tryStatus ===
    for (const payloadItem of items) {
      const orderItem = order.items.id(payloadItem.itemId);

      if (!orderItem) continue;

      if (payloadItem.tryStatus === "keep") {
        orderItem.tryStatus = "accepted";
        orderItem.returnReason = null;
      } else if (payloadItem.tryStatus === "return") {
        orderItem.tryStatus = "returned";
        orderItem.returnReason = payloadItem.returnReason || "Not liked";
      }
    }

    // If user chooses to keep nothing
    const acceptedItems = order.items.filter(
      item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
    );

    if (acceptedItems.length === 0) {
      return res.status(400).json({ message: "No items selected for purchase" });
    }

    // === STEP 2: Use Helper Function for Billing Calculation ===
    const billing = calculateFinalBilling({
      orderItems: order.items,
      returnCharge: order.returnCharge,
      trialPhaseStart: order.trialPhaseStart,
      trialPhaseEnd: order.trialPhaseEnd,
    });

    // === STEP 3: Save billing into DB ===
    order.finalBilling = {
      baseAmount: billing.baseAmount,
      tryAndBuyFee: 0,
      gst: billing.gst,
      discount: billing.returnChargeDeduction, // deduction applied only if all kept
      deliveryCharge: order.deliveryCharge,
      totalPayable: billing.totalPayable,
    };

    order.overtimePenalty = billing.overtimePenalty;
    await order.save();

    // === STEP 4: Create Razorpay Order ===
    const razorpayOrder = await razorpay.orders.create({
      amount: billing.totalPayable * 100,
      currency: "INR",
      receipt: `final_${orderId.slice(-8)}_${Date.now().toString().slice(-6)}`
    });

    // Store latest Razorpay orderId (final payment)
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(200).json({
      success: true,
      razorpayOrder,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: billing.totalPayable * 100,
      currency: "INR",
      orderId: order._id,
      contact: order.deliveryLocation.phone,
      name: order.deliveryLocation.name,
      email: req.user.email || "customer@example.com",
      breakdown: billing, // ⬅ clean!
    });

  } catch (error) {
    console.error("Create Final Payment Order Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const verifyFinalPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    const userId = req.user.userId;

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order || order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Invalid order" });
    }

    // Final updates
    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = "paid";
    
    // Check if all items were accepted (no returned items)
    const returnedItems = order.items.filter(item => item.tryStatus === 'returned');
    const allItemsAccepted = returnedItems.length === 0;
    
    if (allItemsAccepted) {
      // All items were bought - order is fully completed
      order.orderStatus = "completed";
      order.customerDeliveryStatus = "completed";
      order.deliveryRiderStatus = "completed";
          // Clear rider's currentOrderId since order is completed
    // if (order.deliveryRiderId) {
    //   await deliveryRiderModel.findByIdAndUpdate(
    //     order.deliveryRiderId,
    //     { currentOrderId: null }
    //   );
    // }
    } else {
      // Some items were returned - trial phase ended with partial purchase
      order.orderStatus = "completed try phase";
      order.customerDeliveryStatus = "trial_phase_ended";
      order.deliveryRiderStatus = "completed try phase";
    }

    await order.save();



    // Optional: Trigger notifications, invoice, etc.

    return res.status(200).json({
      success: true,
      message: "Final payment successful! Purchase confirmed.",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Verify Final Payment Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};











