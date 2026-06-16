import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import Cart from '../../models/cart.model.js';
import CourierOrder from "../../models/courierOrder.model.js";
import DeliveryRider from '../../models/deliveryRider.model.js';
import Merchant from '../../models/merchant.model.js';
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { notifyMerchant } from "../../sockets/merchant.socket.js";
import Address from "../../models/address.model.js";
import { getIO } from "../../config/socket.js";
import { calculateDeliveryCharge } from "../../helperFns/deliveryChargeFns.js";
import { isWithinTBRadius } from "../../helperFns/geoHelpers.js";
import razorpay from '../../config/RazorPay.js';
import crypto from 'crypto';
import { calculateFinalBilling } from "../../helperFns/calculateFinalBilling.js";
import { enqueueOrder } from "../../helperFns/orderFns.js";
import { notifyOrderEvent } from "../../helperFns/notificationHelper.js";
import mongoose from 'mongoose';
import { findBestOffers, recordOfferUsage, validateOfferEligibility, getApplicableAmount, calculateDiscount } from '../../services/offerEngine.js';
import Offer from '../../models/offer.model.js';
import Zone from "../../models/zone.model.js";
import { inferZone } from "../../utils/zoneInfer.js";



export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { addressId, deliveryTip = 0, merchantId: requestedMerchantId, paymentMethod = 'online' } = req.body;

    if (!requestedMerchantId) {
      return res.status(400).json({ message: "merchantId is required for multi-cart checkout" });
    }

    // === VALIDATE CART ===
    const cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .populate("items.merchantId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    // === FILTER ITEMS FOR REQUESTED MERCHANT ===
    const merchantItems = cart.items.filter(item => {
      const itemMid = item.merchantId?._id?.toString() || item.merchantId?.toString();
      return itemMid === requestedMerchantId;
    });

    if (merchantItems.length === 0) {
      return res.status(400).json({ message: "No items found for this merchant in your cart" });
    }

    const totalMerchantItemsQuantity = merchantItems.reduce((acc, item) => acc + item.quantity, 0);
    if (totalMerchantItemsQuantity > 6) {
      return res.status(400).json({ message: "You can only checkout a maximum of 6 Try & Buy items per merchant." });
    }

    // === VALIDATE ADDRESS ===
    const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
    if (!deliveryAddress) {
      return res.status(404).json({ message: "Delivery address not found" });
    }

    const userCoords = deliveryAddress.location.coordinates;

    // === FETCH MERCHANT ===
    const merchantId = requestedMerchantId;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // === VALIDATE MERCHANT STATUS ===
    if (merchant.isOnline === false) {
      return res.status(400).json({ 
        success: false, 
        message: "This merchant is currently offline and not accepting orders. Please try again later." 
      });
    }

    const merchantCoords = merchant.address.location.coordinates;
    
    // === FETCH APP CONFIG ===
    const AppConfig = (await import("../../models/appConfig.model.js")).default;
    const config = await AppConfig.getConfig();

    // === DELIVERY CHARGE USING HELPER ===
    let { roadDistanceKm, deliveryCharge, returnCharge, estimatedTime } = await calculateDeliveryCharge({
      userCoords,
      merchantCoords,
      deliveryPerKmRate: config.deliveryPerKmRate,
      returnPerKmRate: config.returnPerKmRate,
      waitingCharge: config.waitingCharge
    });

    // === TRY & BUY RADIUS VALIDATION ===
    if (roadDistanceKm > config.tryAndBuyRadius) {
      return res.status(400).json({
        success: false,
        serviceable: false,
        message: `Try & Buy is not available for this location. The merchant is beyond the ${config.tryAndBuyRadius} km road distance.`,
      });
    }
    // === ENFORCE ZONED PENDING ORDERS LIMIT ===
    const zoneId = await inferZone(merchantCoords[1], merchantCoords[0]);
    const zoneDoc = await Zone.findOne({ zoneName: { $regex: new RegExp("^" + zoneId + "$", "i") } });
    const maxPendingOrders = zoneDoc?.maxPendingOrders ?? 5;

    const PendingOrder = (await import("../../models/pendingOrders.model.js")).default;
    const currentPendingCount = await PendingOrder.countDocuments({
      zoneName: zoneId,
      status: { $in: ["queued", "assigned"] }
    });

    if (currentPendingCount >= maxPendingOrders) {
      return res.status(400).json({
        success: false,
        message: "High traffic in this zone. All our delivery partners are currently busy. Please try placing your order after some time."
      });
    }

    const baseDeliveryCharge = deliveryCharge;
    const baseReturnCharge = returnCharge;

    // === CALCULATE TOTAL ===
    let totalAmount = 0;
    const orderItems = [];

    for (const item of merchantItems) {
      const product = item.productId;
      if (!product) continue;

      const variant = product.variants.id(item.variantId);
      if (!variant) continue;

      const sizeObj = variant.sizes.find(s => s.size === item.size);
      if (!sizeObj) {
        return res.status(400).json({ message: `Size ${item.size} not found for product ${product.name}` });
      }

      if (sizeObj.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name} (Size: ${item.size}). Available: ${sizeObj.stock}, Requested: ${item.quantity}` });
      }

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


    // === COMPUTE BEST OFFERS ===
    let appliedOffers = [];
    let offerDiscount = 0;
    try {
      const merchantTotals = {};
      merchantTotals[merchantId.toString()] = totalAmount;

      const bestOffers = await findBestOffers(
        userId,
        { items: orderItems, subtotal: totalAmount, merchantTotals },
        req.body.couponCode || cart.couponCode || null,
        [],
        'try_and_buy'
      );

      if (bestOffers.appliedOffers && bestOffers.appliedOffers.length > 0) {
        for (const offer of bestOffers.appliedOffers) {
          appliedOffers.push({
            offerId: offer._id,
            title: offer.title,
            scope: offer.scope,
            discountType: offer.discountType,
            discountValue: offer.discountValue,
            discountApplied: offer.discountAmount,
            freeDelivery: offer.freeDelivery || false,
          });
          offerDiscount += offer.discountAmount;
        }
      }

      if (bestOffers.freeDelivery) {
        deliveryCharge = 0;
        returnCharge = 0;
      }
    } catch (offerErr) {
      console.error('Offer engine error (non-blocking):', offerErr.message);
    }

    // === SERVICE GST (18% on delivery + tip) ===
    const serviceGST = Math.round((deliveryCharge + deliveryTip) * 0.18);

    // === FINAL PAYABLE ===
    // Customer pays delivery + return charge + tip + service GST upfront.
    const upfrontPayable = Math.round(deliveryCharge + returnCharge + deliveryTip + serviceGST);
    const finalPayable = Math.round(totalAmount - offerDiscount + upfrontPayable);

    let razorpayOrderId = `free_${Date.now()}`;
    let paymentStatus = "delivery_fee_paid";
    
    if (upfrontPayable > 0) {
      // === RAZORPAY ORDER ===
      const razorpayOrder = await razorpay.orders.create({
        amount: upfrontPayable * 100, // Only pay delivery-related fees upfront
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1,
      });
      razorpayOrderId = razorpayOrder.id;
      paymentStatus = "pending";
    }

    // === SAVE ORDER IN DB ===
    const pendingOrder = new Order({
      userId,
      merchantId,
      merchantDetails: {
        name: merchant.shopName,
        phone: merchant.phoneNumber,
      },
      items: orderItems,
      totalAmount,
      finalBilling: {
        deliveryTip,
        serviceGST,
      },
      deliveryCharge,
      originalDeliveryCharge: baseDeliveryCharge, 
      originalReturnCharge: baseReturnCharge,     
      totalPayable: finalPayable,
      deliveryDistance: roadDistanceKm,
      returnCharge,
      estimatedTime,
      appliedOffers,
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
      razorpayOrderId: razorpayOrderId,
      paymentStatus: paymentStatus,
      orderStatus: paymentStatus === "delivery_fee_paid" ? "placed" : "pending",
      paymentMethod: paymentMethod,
    });

  await pendingOrder.save();

  // === RECORD OFFER USAGE ===
  if (paymentStatus === "delivery_fee_paid") {
    // Free order means placed directly
    try {
      for (const offer of appliedOffers) {
        await recordOfferUsage(
          userId,
          offer.offerId,
          pendingOrder._id,
          'Order',
          offer.discountApplied
        );
      }
    } catch (usageErr) {
      console.error('Offer usage recording error (non-blocking):', usageErr.message);
    }
    
    // Clear only this merchant's items from cart (not the whole cart)
    const merchantItemIds = merchantItems.map(i => i._id);
    const updatedCartDoc = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { _id: { $in: merchantItemIds } } } },
      { new: true }
    );
    if (updatedCartDoc && updatedCartDoc.items.length === 0) {
      updatedCartDoc.couponCode = null;
      updatedCartDoc.selectedOffers = [];
      await updatedCartDoc.save();
    }

    // Notify Merchant
    try {
      const io = getIO();
      notifyMerchant(io, pendingOrder.merchantId, pendingOrder.toObject());
      notifyOrderEvent("customer", "order_placed", {
        userId: pendingOrder.userId,
        orderId: pendingOrder._id,
      });
    } catch (socketErr) {
      console.error("Socket notify error (free):", socketErr);
    }
  }

  // === RESPONSE ===
  return res.status(200).json({
    success: true,
    razorpayOrderId: razorpayOrderId,
    amount: Math.round(upfrontPayable * 100),
    key_id: process.env.RAZORPAY_KEY_ID,
    orderId: pendingOrder._id,
    totalDeliveryFee: upfrontPayable,
    deliveryCharge,
    returnCharge,
    deliveryTip,
    serviceGST,
    deliveryDistance: roadDistanceKm,
    estimatedTime,
    contact: deliveryAddress.phone,
    name: deliveryAddress.name,
    email: req.user.email || "customer@example.com",
    isFreeOrder: paymentStatus === "delivery_fee_paid"
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
       STEP 4: REMOVE ONLY THIS ORDER'S MERCHANT ITEMS FROM CART
    ======================== */
    // Remove only items belonging to the merchant of this order
    const orderMerchantId = order.merchantId?.toString();
    const userCart = await Cart.findOne({ userId: order.userId }).session(session);
    if (userCart) {
      const itemIdsToRemove = userCart.items
        .filter(i => (i.merchantId?.toString()) === orderMerchantId)
        .map(i => i._id);
      if (itemIdsToRemove.length > 0) {
        const remainingItems = userCart.items.filter(i => (i.merchantId?.toString()) !== orderMerchantId);
        if (remainingItems.length === 0) {
          await Cart.updateOne(
            { userId: order.userId },
            { $pull: { items: { _id: { $in: itemIdsToRemove } } }, $set: { couponCode: null, selectedOffers: [] } },
            { session }
          );
        } else {
          await Cart.updateOne(
            { userId: order.userId },
            { $pull: { items: { _id: { $in: itemIdsToRemove } } } },
            { session }
          );
        }
      }
    }

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

  if (!signature) {
    return res.status(400).json({ message: "Signature missing" });
  }

  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest !== signature) {
    console.error("[Webhook] Invalid signature");
    return res.status(400).json({ message: "Invalid signature" });
  }

  const event = req.body.event;
  const payload = req.body.payload;
  const payment = payload.payment?.entity;

  console.log(`[Webhook] Received event: ${event} for order: ${payment?.order_id}`);

  if (event === "payment.captured" && payment) {
    const rzpOrderId = payment.order_id;

    // 1. Check if it's a Try & Buy Order
    const order = await Order.findOne({ razorpayOrderId: rzpOrderId });
    if (order) {
      if (order.paymentStatus === "paid" || order.paymentStatus === "delivery_fee_paid" && !order.finalBilling?.totalPayable) {
        console.log(`[Webhook] Order ${order._id} already processed.`);
        return res.status(200).json({ status: "ok" });
      }

      order.razorpayPaymentId = payment.id;
      
      // Determine if this is Upfront or Final payment
      if (order.finalBilling?.totalPayable > 0) {
        // This is the Final Payment
        order.paymentStatus = "paid";
        order.orderStatus = "selection_made";
        order.customerDeliveryStatus = "completed";
        
        // Run settlement
        import("../../helperFns/orderSettlement.js").then(({ settleOrder }) => {
          settleOrder(order).catch(err => console.error("[Webhook] Settlement failed", err));
        });
      } else {
        // This is the Upfront Payment
        order.paymentStatus = "delivery_fee_paid";
        order.orderStatus = "placed";
      }

      await order.save();
      console.log(`[Webhook] Order ${order._id} updated successfully.`);
      return res.status(200).json({ status: "ok" });
    }

    // 2. Check if it's a Courier Order
    const courierOrder = await CourierOrder.findOne({ razorpayOrderId: rzpOrderId });
    if (courierOrder) {
      if (courierOrder.paymentStatus === 'paid') {
        return res.status(200).json({ status: "ok" });
      }

      courierOrder.paymentStatus = 'paid';
      courierOrder.razorpayPaymentId = payment.id;
      courierOrder.orderStatus = 'confirmed';
      await courierOrder.save();
      
      console.log(`[Webhook] CourierOrder ${courierOrder._id} updated successfully.`);
      return res.status(200).json({ status: "ok" });
    }

    // 3. Check if it's a Merchant Registration Fee
    const merchant = await Merchant.findOne({ razorpayOrderId: rzpOrderId });
    if (merchant) {
      if (merchant.isRegistrationFeePaid) {
        return res.status(200).json({ status: "ok" });
      }

      merchant.isRegistrationFeePaid = true;
      merchant.status = 'active';
      merchant.isActive = true;
      await merchant.save();
      
      console.log(`[Webhook] Merchant ${merchant._id} activated via webhook.`);
      return res.status(200).json({ status: "ok" });
    }

    console.warn(`[Webhook] No record found for Razorpay Order ID: ${rzpOrderId}`);
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
      await DeliveryRider.findByIdAndUpdate(deliveryBoyId, { status: "busy" });

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

  order.deliveryBoyStatus = "at_pickup";
  await order.save();
  return res.status(200).json({ message: "Delivery boy reached pickup location" });
};

export const orderPickedUp = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "picked_up";
  order.orderStatus = "in_transit";
  await order.save();
  return res.status(200).json({ message: "Order picked up" });
};

export const reachedDeliveryLocation = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "at_delivery";
  order.orderStatus = "in_transit";
  await order.save();
  return res.status(200).json({ message: "Delivery boy reached delivery location" });
};

export const handoverOrder = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.deliveryBoyStatus = "try_phase";
  order.orderStatus = "try_phase";
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
    .select('orderStatus items totalAmount deliveryRiderStatus deliveryLocation pickupLocation createdAt deliveryDistance')
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {

    let { orderId } = req.params;

    orderId = orderId.replace(/^["']|["']$/g, '').trim();

    const { items } = req.body; // Expected payload: array of { itemId, tryStatus: "keep"|"return", returnReason }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Items array with tryStatus is required" });
    }

    const order = await Order.findById(orderId).populate('items.productId').session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate that all itemIds exist in the order
    const orderItemIds = order.items.map(item => item._id.toString());
    const invalidItem = items.find(
      item => !orderItemIds.includes(item.itemId.toString())
    );
    if (invalidItem) {
      await session.abortTransaction();
      session.endSession();
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

    order.finalBilling.baseAmount = Math.round(baseAmount);
    order.finalBilling.totalPayable = Math.round(baseAmount); // You can add fee/GST later if needed
    // Optionally add tryAndBuyFee, GST, etc. here if applicable

    // Determine final order status
    if (returnedItemsCount === order.items.length) {
      order.orderStatus = "selection_made";
      order.customerDeliveryStatus = "completed";
      order.deliveryRiderStatus = "try_phase"; // Rider will pick up all returns
    } else if (keptItemsCount === order.items.length) {
      order.orderStatus = "selection_made";
      order.deliveryRiderStatus = "try_phase";
      order.customerDeliveryStatus = "awaiting_payment";
    } else {
      order.orderStatus = "selection_made";
      order.customerDeliveryStatus = "awaiting_payment";
    }

    // Mark try phase as completed
    order.trialPhaseEnd = new Date();
    await order.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
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
    await session.abortTransaction();
    session.endSession();
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

    // Guard: prevent duplicate Razorpay orders for already-paid orders
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ message: "Payment already completed for this order" });
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
      // All items returned - no payment needed
      order.orderStatus = "selection_made";
      order.customerDeliveryStatus = 'completed';
      order.deliveryRiderStatus = "returning";

      // === SETTLE RIDER even when all items returned ===
      // Rider still did the delivery + return trip and deserves payment
      try {
        const { settleOrder } = await import("../../helperFns/orderSettlement.js");
        await settleOrder(order);
      } catch (settleErr) {
        console.error("Settlement error (all returned, non-fatal):", settleErr.message);
        order.settlementStatus = 'failed';
      }

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

    // === NEW: Recalculate Offers based strictly on kept items ===
    let recalculatedDiscount = 0;
    
    if (order.appliedOffers && order.appliedOffers.length > 0) {
      const acceptedSubtotal = acceptedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const merchantTotals = {};
      const midStr = order.merchantId?._id ? order.merchantId._id.toString() : order.merchantId.toString();
      merchantTotals[midStr] = acceptedSubtotal;
      
      const cartContext = {
        items: acceptedItems,
        subtotal: acceptedSubtotal,
        merchantTotals,
      };

      for (let i = 0; i < order.appliedOffers.length; i++) {
        const appliedOffer = order.appliedOffers[i];
        try {
          const offerDoc = await Offer.findById(appliedOffer.offerId).lean();
          if (offerDoc) {
            let isStillValid = true;
            
            // Check thresholds
            if (offerDoc.conditions?.minCartValue > 0 && acceptedSubtotal < offerDoc.conditions.minCartValue) {
              isStillValid = false;
            }
            if (offerDoc.conditions?.minOrderValue > 0 && acceptedSubtotal < offerDoc.conditions.minOrderValue) {
              isStillValid = false;
            }

            if (isStillValid) {
              const applicableAmount = getApplicableAmount(offerDoc, cartContext);
              if (applicableAmount > 0) {
                const discount = calculateDiscount(offerDoc, applicableAmount);
                recalculatedDiscount += discount;
                order.appliedOffers[i].discountApplied = discount; // Update DB record
              } else {
                 order.appliedOffers[i].discountApplied = 0;
              }
            } else {
              // Threshold not met anymore -> lose offer completely
              order.appliedOffers[i].discountApplied = 0;
            }
          }
        } catch (e) {
          console.error('Failed to recalculate offer for final billing:', e);
        }
      }
    }

    // === STEP 2: Use Helper Function for Billing Calculation ===
    const billing = calculateFinalBilling({
      orderItems: order.items,
      returnCharge: order.returnCharge,
      trialPhaseStart: order.trialPhaseStart,
      trialPhaseEnd: order.trialPhaseEnd,
      discountToApply: recalculatedDiscount
    });

    console.log("Recalculated Final Billing Payload:", billing);

    // === STEP 3: Save billing into DB (Update, don't overwrite) ===
    order.finalBilling.baseAmount = billing.baseAmount;
    order.finalBilling.gst = billing.gst;
    order.finalBilling.discount = recalculatedDiscount + billing.returnChargeDeduction; 
    order.finalBilling.totalPayable = billing.totalPayable; 

    // Note: deliveryTip and serviceGST are already in order.finalBilling from step 1

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    const userId = req.user.userId;

    // Clean orderId just in case it reaches here with quotes
    if (orderId && typeof orderId === 'string') {
      orderId = orderId.replace(/^["']|["']$/g, '').trim();
    }

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const order = await Order.findOne({ _id: orderId, userId }).session(session);
    if (!order || order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Invalid order" });
    }

    if (order.paymentStatus === "paid") {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        orderId: order._id,
      });
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
      order.orderStatus = "return_in_progress";
      order.customerDeliveryStatus = "completed";
      order.deliveryRiderStatus = "returning";
    }

    // === Deduct stock ONLY for accepted/kept items ===
    const stockUpdateErrors = [];
    for (const item of acceptedItems) {
      const result = await Product.updateOne(
        { _id: item.productId, "variants._id": item.variantId },
        { $inc: { "variants.$[variant].sizes.$[size].stock": -item.quantity } },
        { arrayFilters: [{ "variant._id": item.variantId }, { "size.size": item.size }], session }
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
      }, { session });

      try {
        const { setRiderMeta, getRiderMeta } = await import("../../helperFns/deliveryRiderFns.js");
        const meta = await getRiderMeta(order.deliveryRiderId.toString());
        await setRiderMeta(order.deliveryRiderId.toString(), meta?.zoneId || 'global', {
          isBusy: "false",
          assignedOrderId: "",
        });
      } catch (redisErr) {
        console.error("Redis meta cleanup error in verifyFinalPayment (non-fatal):", redisErr);
      }
    }

    await order.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    // === SETTLE WALLETS FOR MERCHANT, RIDER, ADMIN ===
    // Import dynamically to avoid circular dependencies if any
    const { settleOrder } = await import("../../helperFns/orderSettlement.js");
    // Run settlement asynchronously without passing the session so it doesn't abort the main payment flow
    settleOrder(order).catch(err => {
      console.error("Settlement failed asynchronously:", err);
    });

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
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
};

export const verifyFinalPaymentCod = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, items } = req.body;
    const userId = req.user.userId;

    let cleanOrderId = orderId;
    if (cleanOrderId && typeof cleanOrderId === 'string') {
      cleanOrderId = cleanOrderId.replace(/^["']|["']$/g, '').trim();
    }

    const order = await Order.findOne({ _id: cleanOrderId, userId }).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        orderId: order._id,
      });
    }

    // === STEP 1: Update item tryStatus ===
    for (const payloadItem of items) {
      const orderItem = order.items.id(payloadItem.itemId);
      if (!orderItem) continue;

      if (payloadItem.tryStatus === "keep" || payloadItem.tryStatus === "accepted") {
        orderItem.tryStatus = "accepted";
        orderItem.returnReason = null;
      } else if (payloadItem.tryStatus === "return" || payloadItem.tryStatus === "returned") {
        orderItem.tryStatus = "returned";
        orderItem.returnReason = payloadItem.returnReason || "Not liked";
      }
    }

    const acceptedItems = order.items.filter(
      item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
    );

    // === Recalculate Offers ===
    let recalculatedDiscount = 0;
    if (order.appliedOffers && order.appliedOffers.length > 0) {
      const acceptedSubtotal = acceptedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const merchantTotals = {};
      const midStr = order.merchantId?._id ? order.merchantId._id.toString() : order.merchantId.toString();
      merchantTotals[midStr] = acceptedSubtotal;
      
      const cartContext = {
        items: acceptedItems,
        subtotal: acceptedSubtotal,
        merchantTotals,
      };

      for (let i = 0; i < order.appliedOffers.length; i++) {
        const appliedOffer = order.appliedOffers[i];
        try {
          const offerDoc = await Offer.findById(appliedOffer.offerId).lean();
          if (offerDoc) {
            let isStillValid = true;
            if (offerDoc.conditions?.minCartValue > 0 && acceptedSubtotal < offerDoc.conditions.minCartValue) {
              isStillValid = false;
            }
            if (offerDoc.conditions?.minOrderValue > 0 && acceptedSubtotal < offerDoc.conditions.minOrderValue) {
              isStillValid = false;
            }

            if (isStillValid) {
              const applicableAmount = getApplicableAmount(offerDoc, cartContext);
              if (applicableAmount > 0) {
                const discount = calculateDiscount(offerDoc, applicableAmount);
                recalculatedDiscount += discount;
                order.appliedOffers[i].discountApplied = discount;
              } else {
                order.appliedOffers[i].discountApplied = 0;
              }
            } else {
              order.appliedOffers[i].discountApplied = 0;
            }
          }
        } catch (e) {
          console.error('Failed to recalculate offer for final billing (COD):', e);
        }
      }
    }

    const billing = calculateFinalBilling({
      orderItems: order.items,
      returnCharge: order.returnCharge,
      trialPhaseStart: order.trialPhaseStart,
      trialPhaseEnd: order.trialPhaseEnd,
      discountToApply: recalculatedDiscount
    });

    // Enforce 1000 limit for kept items cash payment
    if (billing.totalPayable > 1000) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Liquid cash is not available for amounts greater than ₹1000. Only online payment is allowed."
      });
    }

    order.finalBilling.baseAmount = billing.baseAmount;
    order.finalBilling.gst = billing.gst;
    order.finalBilling.discount = recalculatedDiscount + billing.returnChargeDeduction;
    order.finalBilling.totalPayable = billing.totalPayable;
    order.overtimePenalty = billing.overtimePenalty;

    order.paymentStatus = "paid";
    order.razorpayPaymentId = `cod_cash_${Date.now()}`;

    const returnedItems = order.items.filter(item => item.tryStatus === 'returned');
    const allItemsAccepted = returnedItems.length === 0;

    if (allItemsAccepted) {
      order.orderStatus = "completed";
      order.customerDeliveryStatus = "completed";
      order.deliveryRiderStatus = "completed";
    } else {
      order.orderStatus = "return_in_progress";
      order.customerDeliveryStatus = "completed";
      order.deliveryRiderStatus = "returning";
    }

    // === Deduct stock for accepted items ===
    const stockUpdateErrors = [];
    for (const item of acceptedItems) {
      const result = await Product.updateOne(
        { _id: item.productId, "variants._id": item.variantId },
        { $inc: { "variants.$[variant].sizes.$[size].stock": -item.quantity } },
        { arrayFilters: [{ "variant._id": item.variantId }, { "size.size": item.size }], session }
      );
      if (result.modifiedCount === 0) {
        stockUpdateErrors.push(item.productId);
      }
    }

    // === Free up rider if all accepted ===
    if (allItemsAccepted && order.deliveryRiderId) {
      await DeliveryRider.findByIdAndUpdate(order.deliveryRiderId, {
        currentOrderId: null,
        isBusy: false,
        isAvailable: true,
      }, { session });

      try {
        const { setRiderMeta, getRiderMeta } = await import("../../helperFns/deliveryRiderFns.js");
        const meta = await getRiderMeta(order.deliveryRiderId.toString());
        await setRiderMeta(order.deliveryRiderId.toString(), meta?.zoneId || 'global', {
          isBusy: "false",
          assignedOrderId: "",
        });
      } catch (redisErr) {
        console.error("Redis meta cleanup error in verifyFinalPaymentCod (non-fatal):", redisErr);
      }
    }

    await order.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    // Settle wallets
    const { settleOrder } = await import("../../helperFns/orderSettlement.js");
    settleOrder(order).catch(err => console.error("Settlement failed asynchronously (COD):", err));

    const io = getIO();
    emitOrderUpdate(io, order._id.toString(), order);

    notifyOrderEvent("customer", "payment_confirmed", {
      userId: order.userId,
      orderId: order._id,
    });

    if (allItemsAccepted) {
      notifyOrderEvent("customer", "delivery_complete", {
        userId: order.userId,
        orderId: order._id,
      });
    } else if (order.deliveryRiderId) {
      notifyOrderEvent("rider", "return_started", {
        riderId: order.deliveryRiderId,
        orderId: order._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: allItemsAccepted
        ? "Selection confirmed. Please hand over the cash to the rider."
        : "Selection confirmed. Please hand over the cash to the rider. Rider will return the remaining items.",
      orderId: order._id,
      hasReturnItems: !allItemsAccepted,
      stockWarnings: stockUpdateErrors.length > 0 ? stockUpdateErrors : undefined,
    });

  } catch (error) {
    console.error("Verify Final Payment COD Error:", error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await Order.findOne({ _id: orderId, userId }).session(session);
    
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.orderStatus !== "placed") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Cannot cancel order in ${order.orderStatus} state` });
    }

    // 💰 Refund full upfront amount to customer wallet
    const refundAmount = (order.deliveryCharge || 0) + (order.returnCharge || 0) + (order.finalBilling?.deliveryTip || 0) + (order.finalBilling?.serviceGST || 0);

    if (refundAmount > 0) {
      const { creditWallet } = await import("../../helperFns/walletHelper.js");
      await creditWallet({
        ownerType: "user",
        ownerId: order.userId,
        amount: refundAmount,
        description: `Refund: Cancelled order #${order._id.toString().slice(-5).toUpperCase()}`,
        orderId: order._id,
        session
      });
      order.paymentStatus = "refunded";
    }

    order.orderStatus = "cancelled";
    order.customerDeliveryStatus = "cancelled";
    await order.save({ session });

    // Remove from pending orders queue if it exists
    const PendingOrder = (await import("../../models/pendingOrders.model.js")).default;
    await PendingOrder.deleteOne({ orderId: order._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    // 📱 Customer notification: "Order Cancelled"
    notifyOrderEvent("customer", "order_cancelled", {
      userId: order.userId,
      orderId: order._id,
      amount: refundAmount,
    });
    
    // Also notify merchant via socket since order is cancelled before they accepted
    const io = getIO();
    emitOrderUpdate(io, order._id.toString(), order);
    const { notifyMerchant } = await import("../../sockets/merchant.socket.js");
    notifyMerchant(io, order.merchantId, `Order #${order._id.toString().slice(-5).toUpperCase()} was cancelled by user.`);

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully, upfront fee refunded to wallet",
      order
    });

  } catch (error) {
    console.error("Cancel Order Error:", error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Server error" });
  }
};











