import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import Cart from '../../models/cart.model.js';
import DeliveryRider from '../../models/deliveryRider.model.js';
import Merchant from '../../models/merchant.model.js';
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { notifyMerchant } from "../../sockets/merchant.socket.js";
import Address from "../../models/address.model.js";
import { getIO } from "../../config/socket.js";
import { calculateDeliveryCharge } from "../../helperFns/deliveryChargeFns.js";
import razorpay from '../../config/RazorPay.js';
import crypto from 'crypto';
import { calculateFinalBilling } from "../../helperFns/calculateFinalBilling.js";
import { enqueueOrder } from "../../helperFns/orderFns.js";
import { notifyOrderEvent } from "../../helperFns/notificationHelper.js";
import mongoose from 'mongoose';



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

    // === FETCH APP CONFIG ===
    const AppConfig = (await import("../../models/appConfig.model.js")).default;
    const config = await AppConfig.getConfig();

    // === DELIVERY CHARGE USING HELPER ===
    const { distanceKm, deliveryCharge, returnCharge, estimatedTime } = calculateDeliveryCharge({
      userCoords,
      merchantCoords,
      deliveryPerKmRate: config.deliveryPerKmRate,
      returnPerKmRate: config.returnPerKmRate,
      waitingCharge: config.waitingCharge
    });

    // === CALCULATE TOTAL ===
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.productId;
      if (!product) continue;

      const variant = product.variants.id(item.variantId);
      if (!variant) continue;

      const price = variant.price;

      for (let i = 0; i < item.quantity; i++) {
        totalAmount += price;

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId,
          name: product.name,
          quantity: 1, // 🔥 ALWAYS 1
          price,
          size: item.size,
          image: item.image?.url || "",
          tryStatus: product.isTriable ? "pending" : "not-triable",
        });
      }
    }


    // === FINAL PAYABLE ===
    // Customer pays delivery + return charge upfront.
    const totalDeliveryFee = deliveryCharge + returnCharge;
    const finalPayable = totalAmount + totalDeliveryFee;

    // === RAZORPAY ORDER ===
    const razorpayOrder = await razorpay.orders.create({
      amount: totalDeliveryFee * 100, // Only pay delivery upfront
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
    });

    await pendingOrder.save();

    // === RESPONSE ===
    return res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: totalDeliveryFee * 100,
      key_id: process.env.RAZORPAY_KEY_ID,
      orderId: pendingOrder._id,
      deliveryCharge,
      returnCharge,
      totalDeliveryFee,
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId, // internal pending order ID
    } = req.body;

    /* =======================
       STEP 1: VERIFY SIGNATURE
    ======================== */
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    /* =======================
       STEP 2: FETCH ORDER
    ======================== */
    const order = await Order.findById(orderId).session(session);

    if (!order || order.razorpayOrderId !== razorpay_order_id) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        orderId: order._id,
      });
    }

    /* =======================
       STEP 3: UPDATE ORDER — mark as placed (NOT yet confirmed_purchase)
       Stock is only deducted after the trial when the customer confirms kept items
    ======================== */
    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = "delivery_fee_paid";
    order.orderStatus = "placed";
    await order.save({ session });

    /* =======================
       STEP 4: CLEAR USER CART
    ======================== */
    await Cart.updateOne(
      { userId: order.userId },
      { $set: { items: [], merchantId: null } },
      { session }
    );

    /* =======================
       STEP 5: COMMIT TRANSACTION
    ======================== */
    await session.commitTransaction();
    session.endSession();

    /* =======================
       STEP 6: NOTIFY MERCHANT + CONFIRM PLACED
    ======================== */
    try {
      const io = getIO();
      notifyMerchant(io, order.merchantId, order);
    } catch (socketErr) {
      console.error("Socket notify error:", socketErr);
    }

    // 📱 Customer notification: "Order Placed" (selective milestone #1)
    notifyOrderEvent("customer", "order_placed", {
      userId: order.userId,
      orderId: order._id,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified. Order placed — awaiting merchant acceptance.",
      orderId: order._id,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Verify Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
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

        // Dynamically import and run settlement
        import("../../helperFns/orderSettlement.js").then(({ settleOrder }) => {
          settleOrder(order).catch(err => console.error("Webhook Settlement failed", err));
        });

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
      order.deliveryRiderId = deliveryBoyId;
      order.deliveryRiderStatus = "assigned";

      // Update delivery boy’s availability
      await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, { status: "busy" });

      await order.save();
      return res.status(200).json({
        message: "Order accepted and assigned to delivery boy",
        order,
      });
    }

    if (action === "reject") {
      order.deliveryRiderStatus = "rejected";
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

  order.orderStatus = "packed"
  await order.save();
  return res.status(200).json({ message: "Order packed" });
};

export const reachedPickupLocation = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "arrived at pickup";
  await order.save();
  return res.status(200).json({ message: "Delivery boy reached pickup location" });
};

export const orderPickedUp = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "picked & verified order";
  order.orderStatus = "out_for_delivery";
  await order.save();
  return res.status(200).json({ message: "Order picked up" });
};

export const reachedDeliveryLocation = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "arrived at delivery";
  order.orderStatus = "arrived at delivery";
  await order.save();
  return res.status(200).json({ message: "Delivery boy reached delivery location" });
};

export const handoverOrder = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "try phase";
  order.orderStatus = "try phase";
  await order.save();
  return res.status(200).json({ message: "Order handover" });
};


export const getOrderForMerchant = async (req, res) => {
  const orders = await Order.find({ merchantId: req.merchant.merchantId })
    .select('orderStatus items totalAmount deliveryRiderStatus createdAt deliveryRiderDetails')
    .sort({ createdAt: -1 })
    .lean();
  return res.status(200).json({ orders });
};

export const getOrderForDeliveryBoy = async (req, res) => {
  const { deliveryBoyId } = req.params;
  const orders = await Order.find({ deliveryBoyId })
    .select('orderStatus items totalAmount deliveryRiderStatus deliveryLocation pickupLocation createdAt')
    .sort({ createdAt: -1 })
    .lean();
  return res.status(200).json({ orders });
};

export const getOrderForUser = async (req, res) => {
  const { userId } = req.params;
  const orders = await Order.find({ userId })
    .select('orderStatus items totalAmount customerDeliveryStatus createdAt merchantDetails deliveryCharge')
    .sort({ createdAt: -1 })
    .lean();
  return res.status(200).json({ orders });
};

export const getAllOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const orders = await Order.find({ userId })
      .select('orderStatus items totalAmount customerDeliveryStatus createdAt merchantDetails deliveryCharge finalBilling')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch orders' });
  }
}

export const initiateReturn = async (req, res) => {
  try {

    let { orderId } = req.params;

    orderId = orderId.replace(/^["']|["']$/g, '').trim();

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
      order.customerDeliveryStatus = "completed";

      order.deliveryRiderStatus = "completed try phase"; // Rider will pick up all
    } else if (keptItemsCount === order.items.length) {
      order.orderStatus = "confirmed_purchase";
      order.deliveryRiderStatus = "confirmed purchase";
      order.customerDeliveryStatus = "trial_phase_ended"

    } else {
      order.orderStatus = "partially_returned";
    }

    // Mark try phase as completed
    order.trialPhaseEnd = new Date();
    await order.save();
    // Emit real-time update (assuming you have socket.io set up)
    const io = getIO();
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
    const cleanOrderId = orderId.replace(/^"|"$/g, '');
    const order = await Order.findById(cleanOrderId)
      .select('-deliveryTracking -razorpayPaymentId -razorpayOrderId')
      .lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.status(200).json({ order });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createFinalPaymentRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const { items } = req.body;
    console.log(req.body);


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
      } else if (payloadItem.tryStatus === "return" || payloadItem.tryStatus === "returned") {
        orderItem.tryStatus = "returned";
        orderItem.returnReason = payloadItem.returnReason || "Not liked";
      }
    }

    // If user chooses to keep nothing
    const acceptedItems = order.items.filter(
      item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
    );

    if (acceptedItems.length === 0) {
      console.log(acceptedItems, "wwwwwqqqqq");

      // All items returned - no payment needed
      order.orderStatus = "completed try phase";

      order.customerDeliveryStatus = 'trial_phase_ended';
      order.deliveryRiderStatus = "completed try phase";

      // Clear rider's currentOrderId since order is completed
      // if (order.deliveryRiderId) {
      //   await DeliveryRider.findByIdAndUpdate(
      //     order.deliveryRiderId,
      //     { currentOrderId: null }
      //   );
      // }

      await order.save();
      const io = getIO();
      emitOrderUpdate(io, orderId, order)

      return res.status(200).json({
        success: true,
        message: "All items returned. No payment required.",
        orderId: order._id,
        order: order,
        requiresPayment: false,
      });
    }

    // === STEP 2: Use Helper Function for Billing Calculation ===
    const billing = calculateFinalBilling({
      orderItems: order.items,
      returnCharge: order.returnCharge,
      trialPhaseStart: order.trialPhaseStart,
      trialPhaseEnd: order.trialPhaseEnd,
    });

    console.log(billing, "sdfdfs");


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

    // === Mark payment done ===
    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = "paid";

    const returnedItems = order.items.filter(item => item.tryStatus === 'returned');
    const acceptedItems = order.items.filter(item =>
      item.tryStatus === 'accepted' || item.tryStatus === 'not-triable'
    );
    const allItemsAccepted = returnedItems.length === 0;

    if (allItemsAccepted) {
      order.orderStatus = "completed";
      order.customerDeliveryStatus = "completed";
      order.deliveryRiderStatus = "completed";
    } else {
      // Partial/full return — rider still needs to go back to merchant
      order.orderStatus = "completed try phase";
      order.customerDeliveryStatus = "trial_phase_ended";
      order.deliveryRiderStatus = "completed try phase";
    }

    // === Deduct stock ONLY for accepted/kept items ===
    const stockUpdateErrors = [];
    for (const item of acceptedItems) {
      const result = await Product.updateOne(
        { _id: item.productId, "variants._id": item.variantId },
        { $inc: { "variants.$[variant].sizes.$[size].stock": -item.quantity } },
        { arrayFilters: [{ "variant._id": item.variantId }, { "size.size": item.size }] }
      );
      if (result.modifiedCount === 0) {
        stockUpdateErrors.push(item.productId);
        console.warn(`Stock not updated for product ${item.productId} — may already be 0`);
      }
    }

    // ... existing code ...
    // === Free up the rider if all items accepted (no return trip needed) ===
    if (allItemsAccepted && order.deliveryRiderId) {
      await DeliveryRider.findByIdAndUpdate(order.deliveryRiderId, {
        currentOrderId: null,
        isBusy: false,
        isAvailable: true,
      });
    }

    // === SETTLE WALLETS FOR MERCHANT, RIDER, ADMIN ===
    // Import dynamically to avoid circular dependencies if any
    const { settleOrder } = await import("../../helperFns/orderSettlement.js");
    await settleOrder(order).catch(err => console.error("Settlement failed non-fatally", err));

    await order.save();

    const io = getIO();
    emitOrderUpdate(io, orderId, order);

    // 📱 Customer notification: "Payment Confirmed" (selective milestone #3)
    notifyOrderEvent("customer", "payment_confirmed", {
      userId: order.userId,
      orderId: order._id,
    });

    if (allItemsAccepted) {
      // 📱 Customer notification: "Order Complete" (selective milestone #4 — final)
      notifyOrderEvent("customer", "delivery_complete", {
        userId: order.userId,
        orderId: order._id,
      });
    } else if (order.deliveryRiderId) {
      // 📱 Rider notification: "Head back to merchant with returns"
      notifyOrderEvent("rider", "return_started", {
        riderId: order.deliveryRiderId,
        orderId: order._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: allItemsAccepted
        ? "Payment confirmed! Your order is complete."
        : "Payment confirmed. Rider will now return the remaining items.",
      orderId: order._id,
      hasReturnItems: !allItemsAccepted,
      stockWarnings: stockUpdateErrors.length > 0 ? stockUpdateErrors : undefined,
    });
  } catch (error) {
    console.error("Verify Final Payment Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};












