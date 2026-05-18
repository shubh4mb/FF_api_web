import CourierOrder from "../../models/courierOrder.model.js";
import CourierCart from "../../models/courierCart.model.js";
import Merchant from "../../models/merchant.model.js";
import Product from "../../models/product.model.js";
import Address from "../../models/address.model.js";
import mongoose from "mongoose";
import crypto from "crypto";
import razorpay from "../../config/RazorPay.js";
import { findBestOffers, recordOfferUsage } from '../../services/offerEngine.js';

const COURIER_DELIVERY_CHARGE = 40;

/**
 * 1. Initiate Courier Order — creates a real Razorpay order
 * Validates cart and address, calculates billing, creates Razorpay order.
 */
export const initiateCourierOrder = async (req, res) => {
  const userId = req.user.userId;
  const { merchantId, addressId, deliveryTip = 0 } = req.body;

  if (!merchantId || !addressId) {
    return res.status(400).json({ success: false, message: "merchantId and addressId are required" });
  }

  try {
    // 1. Validate Merchant
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }
    // if (!merchant.enableCourierDelivery) {
    //   return res.status(400).json({ success: false, message: `Merchant ${merchantId} does not support courier delivery.` });
    // }

    // 2. Validate Address
    const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
    if (!deliveryAddress) {
      return res.status(404).json({ success: false, message: "Delivery address not found" });
    }

    // 3. Get Courier Cart Items
    const cart = await CourierCart.findOne({ userId }).populate({
      path: "items.productId",
      select: "name variants images categoryId subCategoryId brandId gender tags collectionIds",
    });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Courier cart is empty" });
    }

    const merchantItems = cart.items.filter(
      item => item.merchantId && item.merchantId.toString() === merchantId.toString()
    );

    if (merchantItems.length === 0) {
      const cartMerchantIds = cart.items.map(i => i.merchantId?.toString());
      return res.status(400).json({ 
        success: false, 
        message: `No items from merchant ${merchantId} in courier cart. Cart has items from: ${cartMerchantIds.join(', ')}` 
      });
    }

    // 4. Calculate Billing
    let totalAmount = 0;
    const orderItems = [];

    for (const item of merchantItems) {
      const product = item.productId;
      if (!product) continue;

      const variant = product.variants.id(item.variantId);
      if (!variant) continue;

      const price = variant.price;
      totalAmount += price * item.quantity;

      orderItems.push({
        productId: item.productId._id,
        variantId: item.variantId,
        name: product.name,
        quantity: item.quantity,
        price,
        size: item.size,
        image: item.image?.url || item.image,
      });
    }

    const serviceGST = 0; // Removed GST as requested

    // === COMPUTE BEST OFFERS ===
    let appliedOffers = [];
    let offerDiscount = 0;
    let offerFreeDelivery = false;
    try {
      const merchantTotals = {};
      merchantTotals[merchantId.toString()] = totalAmount;

      const bestOffers = await findBestOffers(
        userId,
        { items: orderItems, subtotal: totalAmount, merchantTotals },
        req.body.couponCode || null,
        [],
        'courier'
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
          });
          offerDiscount += offer.discountAmount;
        }
      }

      if (bestOffers.freeDelivery) {
        offerFreeDelivery = true;
      }
    } catch (offerErr) {
      console.error('Offer engine error (non-blocking):', offerErr.message);
    }

    const finalDeliveryCharge = offerFreeDelivery ? 0 : COURIER_DELIVERY_CHARGE;
    const totalPayable = totalAmount - offerDiscount + finalDeliveryCharge + deliveryTip;
    const amountInPaise = Math.round(totalPayable * 100);

    // 5. Create real Razorpay order
    let razorpayOrderId;
    let paymentStatus = 'pending';

    if (amountInPaise > 0) {
      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `courier_${Date.now()}`,
        payment_capture: 1,
      });
      razorpayOrderId = razorpayOrder.id;
    } else {
      // Free order — no Razorpay needed
      razorpayOrderId = `free_courier_${Date.now()}`;
      paymentStatus = 'paid';
    }
    
    const courierOrder = new CourierOrder({
      userId,
      merchantId,
      merchantDetails: {
        name: merchant.shopName,
        phone: merchant.phoneNumber,
      },
      items: orderItems,
      totalAmount,
      discount: offerDiscount,
      deliveryCharge: COURIER_DELIVERY_CHARGE,
      serviceGST,
      deliveryTip,
      totalPayable,
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
      razorpayOrderId,
      paymentStatus,
      orderStatus: paymentStatus === 'paid' ? 'confirmed' : 'placed',
    });

    await courierOrder.save();

    // === RECORD OFFER USAGE ===
    try {
      for (const offer of appliedOffers) {
        await recordOfferUsage(
          userId,
          offer.offerId,
          courierOrder._id,
          'CourierOrder',
          offer.discountApplied
        );
      }
    } catch (usageErr) {
      console.error('Offer usage recording error (non-blocking):', usageErr.message);
    }

    // If free order, clear cart immediately
    if (paymentStatus === 'paid') {
      const cartDoc = await CourierCart.findOne({ userId });
      if (cartDoc) {
        cartDoc.items = cartDoc.items.filter(
          item => item.merchantId.toString() !== merchantId.toString()
        );
        await cartDoc.save();
      }
    }

    res.status(200).json({
      success: true,
      message: paymentStatus === 'paid' ? "Free order placed successfully" : "Order initiated — proceed to payment",
      razorpayOrderId,
      amount: amountInPaise,
      key_id: process.env.RAZORPAY_KEY_ID,
      totalPayable,
      orderId: courierOrder._id,
      contact: deliveryAddress.phone,
      name: deliveryAddress.name,
      email: req.user.email || "customer@example.com",
      isFreeOrder: paymentStatus === 'paid',
    });

  } catch (err) {
    console.error("Initiate courier order error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * 2. Verify Courier Payment — validates Razorpay signature
 * Finalizes the order, deducts stock, and clears items from Courier Cart.
 */
export const verifyCourierOrderPayment = async (req, res) => {
  const userId = req.user.userId;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required" });
  }

  // === STEP 1: Verify Razorpay Signature ===
  const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign)
    .digest("hex");

  if (expectedSign !== razorpay_signature) {
    return res.status(400).json({ success: false, message: "Invalid payment signature" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await CourierOrder.findOne({ razorpayOrderId: razorpay_order_id, userId }).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus === 'paid') {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ success: true, message: "Already paid", orderId: order._id });
    }

    // === STEP 2: Update Order Status ===
    order.paymentStatus = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.orderStatus = 'confirmed';
    await order.save({ session });

    // === STEP 3: Deduct Stock ===
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.productId, "variants._id": item.variantId },
        { $inc: { "variants.$[variant].sizes.$[size].stock": -item.quantity } },
        { arrayFilters: [{ "variant._id": item.variantId }, { "size.size": item.size }], session }
      );
    }

    // === STEP 4: Clear Items from Courier Cart ===
    const cart = await CourierCart.findOne({ userId }).session(session);
    if (cart) {
      cart.items = cart.items.filter(
        item => item.merchantId.toString() !== order.merchantId.toString()
      );
      await cart.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Payment verified. Order confirmed.",
      orderId: order._id,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Verify courier payment error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


/**
 * Get all courier orders for logged-in user
 */
export const getUserCourierOrders = async (req, res) => {
  const userId = req.user.userId;

  try {
    const orders = await CourierOrder.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error("Get user courier orders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get single courier order by ID
 */
export const getCourierOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await CourierOrder.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, order });
  } catch (err) {
    console.error("Get courier order error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get all courier orders for a merchant
 */
export const getMerchantCourierOrders = async (req, res) => {
  const merchantId = req.merchantId || req.params.merchantId;

  try {
    const orders = await CourierOrder.find({ merchantId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error("Get merchant courier orders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Update courier order status (Merchant)
 */
export const updateCourierOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Invalid status` });
  }

  try {
    const order = await CourierOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Authorization check
    if (order.merchantId.toString() !== req.merchantId.toString()) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this order" });
    }

    order.orderStatus = status;
    // Sync customer delivery status if applicable
    if (['shipped', 'delivered', 'cancelled'].includes(status)) {
        order.customerDeliveryStatus = status;
    }

    await order.save();

    res.status(200).json({ success: true, message: `Order status updated to ${status}`, order });
  } catch (err) {
    console.error("Update courier order status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Cancel a courier order (User)
 */
export const cancelCourierOrder = async (req, res) => {
  const userId = req.user.userId;
  const { orderId } = req.params;

  try {
    const order = await CourierOrder.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!['placed', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled at this stage" });
    }

    order.orderStatus = 'cancelled';
    order.customerDeliveryStatus = 'cancelled';
    await order.save();

    res.status(200).json({ success: true, message: "Courier order cancelled", order });
  } catch (err) {
    console.error("Cancel courier order error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
