import CourierOrder from "../../models/courierOrder.model.js";
import CourierCart from "../../models/courierCart.model.js";
import Merchant from "../../models/merchant.model.js";
import Product from "../../models/product.model.js";
import Address from "../../models/address.model.js";
import mongoose from "mongoose";
import crypto from "crypto";
import razorpay from "../../config/RazorPay.js";
import { findBestOffers, recordOfferUsage } from '../../services/offerEngine.js';
import { v2 as cloudinary } from 'cloudinary';

const COURIER_DELIVERY_CHARGE = 40;

/**
 * 1. Initiate Courier Order — creates a real Razorpay order
 * Validates cart and address, calculates billing, creates Razorpay order.
 */
export const initiateCourierOrder = async (req, res) => {
  const userId = req.user.userId;
  const { merchantId, addressId, deliveryTip = 0, deliveryCharge } = req.body;

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

    // === COMPUTE BEST OFFERS ON GLOBAL COURIER CART ===
    let appliedOffers = [];
    let offerDiscount = 0;
    let offerFreeDelivery = false;
    try {
      let globalSubtotal = 0;
      const globalOrderItems = [];
      const globalMerchantTotals = {};

      for (const item of cart.items) {
        const product = item.productId;
        if (!product) continue;

        const variant = product.variants?.id(item.variantId);
        if (!variant) continue;

        const price = variant.price;
        globalSubtotal += price * item.quantity;
        
        const mIdStr = item.merchantId?.toString();
        if (mIdStr) {
          globalMerchantTotals[mIdStr] = (globalMerchantTotals[mIdStr] || 0) + price * item.quantity;
        }

        globalOrderItems.push({
          productId: item.productId._id || item.productId,
          variantId: item.variantId,
          name: product.name,
          quantity: item.quantity,
          price,
          size: item.size,
          image: item.image?.url || item.image,
          merchantId: item.merchantId,
        });
      }

      const globalDeliveryCharge = 40;

      const bestOffers = await findBestOffers(
        userId,
        {
          items: globalOrderItems,
          subtotal: globalSubtotal,
          merchantTotals: globalMerchantTotals,
          totalDeliveryCharge: globalDeliveryCharge,
          totalReturnCharge: 0,
        },
        req.body.couponCode || cart.couponCode || null,
        cart.selectedOffers || [],
        'courier'
      );

      if (bestOffers.appliedOffers && bestOffers.appliedOffers.length > 0) {
        for (const offer of bestOffers.appliedOffers) {
          let distributedDiscount = 0;
          if (offer.scope === 'merchant' && offer.merchantId?.toString() === merchantId.toString()) {
            distributedDiscount = offer.discountAmount;
          } else if (offer.scope === 'admin') {
            distributedDiscount = Math.round((totalAmount / globalSubtotal) * offer.discountAmount);
          }

          if (distributedDiscount > 0) {
            appliedOffers.push({
              offerId: offer._id,
              title: offer.title,
              scope: offer.scope,
              discountType: offer.discountType,
              discountValue: offer.discountValue,
              discountApplied: distributedDiscount,
            });
            offerDiscount += distributedDiscount;
          }
        }
      }

      if (bestOffers.freeDelivery) {
        offerFreeDelivery = true;
      }
    } catch (offerErr) {
      console.error('Offer engine error (non-blocking):', offerErr.message);
    }

    const finalDeliveryCharge = offerFreeDelivery ? 0 : (deliveryCharge !== undefined ? Number(deliveryCharge) : COURIER_DELIVERY_CHARGE);
    const totalPayable = Math.round(totalAmount - offerDiscount + finalDeliveryCharge + deliveryTip);
    const amountInPaise = totalPayable * 100;

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

export const initiateCourierCheckout = async (req, res) => {
  const userId = req.user.userId;
  const { addressId, deliveryTip = 0 } = req.body;

  if (!addressId) {
    return res.status(400).json({ success: false, message: "addressId is required" });
  }

  try {
    // 1. Fetch address
    const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
    if (!deliveryAddress) {
      return res.status(404).json({ success: false, message: "Delivery address not found" });
    }

    // 2. Fetch active courier cart items
    const cart = await CourierCart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Courier cart is empty" });
    }

    // 3. Group items by merchant
    const itemsByMerchant = {};
    for (const item of cart.items) {
      const product = item.productId;
      if (!product) continue;
      const merchantId = item.merchantId?.toString();
      if (!itemsByMerchant[merchantId]) {
        itemsByMerchant[merchantId] = [];
      }
      itemsByMerchant[merchantId].push(item);
    }

    const merchantIds = Object.keys(itemsByMerchant);
    if (merchantIds.length === 0) {
      return res.status(400).json({ success: false, message: "No valid items in courier cart" });
    }

    // Calculate global cart properties first (for best offers and to get global totals)
    const globalOrderItems = [];
    const globalMerchantTotals = {};
    let globalSubtotal = 0;

    for (const merchantId of merchantIds) {
      const items = itemsByMerchant[merchantId];
      for (const item of items) {
        const product = item.productId;
        const variant = product?.variants?.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
        const price = variant?.price || 0;
        globalSubtotal += price * item.quantity;
        globalMerchantTotals[merchantId] = (globalMerchantTotals[merchantId] || 0) + price * item.quantity;

        globalOrderItems.push({
          productId: product._id,
          variantId: item.variantId,
          name: product.name,
          quantity: item.quantity,
          price,
          size: item.size,
          image: item.image?.url || item.image,
          merchantId: item.merchantId,
        });
      }
    }

    // Best offers evaluation
    let offerFreeDelivery = false;
    let bestOffers = { appliedOffers: [], totalDiscount: 0, freeDelivery: false };
    try {
      bestOffers = await findBestOffers(
        userId,
        {
          items: globalOrderItems,
          subtotal: globalSubtotal,
          merchantTotals: globalMerchantTotals,
          totalDeliveryCharge: 40,
          totalReturnCharge: 0,
        },
        cart.couponCode || null,
        cart.selectedOffers || [],
        'courier'
      );
      if (bestOffers.freeDelivery) {
        offerFreeDelivery = true;
      }
    } catch (offerErr) {
      console.error('Offer engine error in initiateCourierCheckout:', offerErr.message);
    }

    // Create unique receipt / order tracking
    const grandRazorpayOrderId = `courier_${Date.now()}`;
    let paymentStatus = 'pending';
    let grandTotalPayable = 0;

    const createdOrders = [];

    // Distribute charges & create orders
    for (let index = 0; index < merchantIds.length; index++) {
      const merchantId = merchantIds[index];
      const items = itemsByMerchant[merchantId];
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) continue;

      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const product = item.productId;
        const variant = product?.variants?.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
        const price = variant?.price || 0;
        totalAmount += price * item.quantity;

        orderItems.push({
          productId: product._id,
          variantId: item.variantId,
          name: product.name,
          quantity: item.quantity,
          price,
          size: item.size,
          image: item.image?.url || item.image,
        });
      }

      // Distribute coupon/offer discount proportionally
      let offerDiscount = 0;
      const appliedOffers = [];

      if (bestOffers.appliedOffers && bestOffers.appliedOffers.length > 0) {
        for (const offer of bestOffers.appliedOffers) {
          let distributedDiscount = 0;
          if (offer.scope === 'merchant' && offer.merchantId?.toString() === merchantId) {
            distributedDiscount = offer.discountAmount;
          } else if (offer.scope === 'admin') {
            distributedDiscount = Math.round((totalAmount / globalSubtotal) * offer.discountAmount);
          }

          if (distributedDiscount > 0) {
            appliedOffers.push({
              offerId: offer._id,
              title: offer.title,
              scope: offer.scope,
              discountType: offer.discountType,
              discountValue: offer.discountValue,
              discountApplied: distributedDiscount,
            });
            offerDiscount += distributedDiscount;
          }
        }
      }

      // First merchant order gets the tip and the delivery fee (if not free)
      const isFirst = index === 0;
      const merchantDeliveryCharge = offerFreeDelivery ? 0 : (isFirst ? 40 : 0);
      const merchantTip = isFirst ? Number(deliveryTip) : 0;
      const serviceGST = 0;

      const totalPayable = Math.round(totalAmount - offerDiscount + merchantDeliveryCharge + merchantTip);
      grandTotalPayable += totalPayable;

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
        deliveryCharge: merchantDeliveryCharge,
        serviceGST,
        deliveryTip: merchantTip,
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
        razorpayOrderId: grandRazorpayOrderId,
        paymentStatus,
        orderStatus: 'placed',
      });

      await courierOrder.save();
      createdOrders.push(courierOrder);

      // Record offer usages
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
    }

    grandTotalPayable = Math.round(grandTotalPayable);
    const amountInPaise = grandTotalPayable * 100;

    let finalRazorpayOrderId = grandRazorpayOrderId;

    if (amountInPaise > 0) {
      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `courier_${Date.now()}`,
        payment_capture: 1,
      });
      finalRazorpayOrderId = razorpayOrder.id;

      // Update all orders with the real Razorpay Order ID
      for (const order of createdOrders) {
        order.razorpayOrderId = finalRazorpayOrderId;
        order.orderStatus = 'placed';
        await order.save();
      }
    } else {
      // Free order
      paymentStatus = 'paid';
      for (const order of createdOrders) {
        order.razorpayOrderId = `free_courier_${Date.now()}`;
        order.paymentStatus = 'paid';
        order.orderStatus = 'confirmed';
        await order.save();
      }

      // Clear courier cart
      const cartDoc = await CourierCart.findOne({ userId });
      if (cartDoc) {
        cartDoc.items = [];
        cartDoc.couponCode = null;
        cartDoc.selectedOffers = [];
        await cartDoc.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: paymentStatus === 'paid' ? "Free order placed successfully" : "Orders initiated — proceed to payment",
      razorpayOrderId: finalRazorpayOrderId,
      amount: amountInPaise,
      key_id: process.env.RAZORPAY_KEY_ID,
      totalPayable: grandTotalPayable,
      orderId: createdOrders[0]._id,
      contact: deliveryAddress.phone,
      name: deliveryAddress.name,
      email: req.user.email || "customer@example.com",
      isFreeOrder: paymentStatus === 'paid',
    });

  } catch (err) {
    console.error("Initiate courier checkout error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


/**
 * 2. Verify Courier Payment — validates Razorpay signature
 * Finalizes the order, deducts stock, and clears items from Courier Cart.
 */
export const verifyCourierOrderPayment = async (req, res) => {
  const userId = req.user.userId;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

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
    const orders = await CourierOrder.find({ razorpayOrderId: razorpay_order_id, userId }).session(session);
    if (!orders || orders.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Orders not found" });
    }

    const allPaid = orders.every(o => o.paymentStatus === 'paid');
    if (allPaid) {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ success: true, message: "Already paid", orderId: orders[0]._id });
    }

    const merchantIdsToClear = [];

    // === STEP 2: Update Order Statuses ===
    for (const order of orders) {
      if (order.paymentStatus !== 'paid') {
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

        merchantIdsToClear.push(order.merchantId.toString());
      }
    }

    // === STEP 4: Clear Items from Courier Cart ===
    const cart = await CourierCart.findOne({ userId }).session(session);
    if (cart && merchantIdsToClear.length > 0) {
      cart.items = cart.items.filter(
        item => !merchantIdsToClear.includes(item.merchantId.toString())
      );
      if (cart.items.length === 0) {
        cart.couponCode = null;
        cart.selectedOffers = [];
      }
      await cart.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Payment verified. Orders confirmed.",
      orderId: orders[0]._id,
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
    const orders = await CourierOrder.find({ merchantId, paymentStatus: { $ne: 'pending' } })
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

/**
 * Helper to calculate return charge based on delivery vs merchant address
 */
export const calculateReturnCharge = (deliveryLocation, merchantAddress) => {
  if (!deliveryLocation || !merchantAddress) return 120; // Default fallback

  const deliveryCity = (deliveryLocation.city || "").trim().toLowerCase();
  const deliveryState = (deliveryLocation.state || "").trim().toLowerCase();
  const merchantCity = (merchantAddress.city || "").trim().toLowerCase();
  const merchantState = (merchantAddress.state || "").trim().toLowerCase();

  if (deliveryCity && merchantCity && deliveryCity === merchantCity) {
    return 50;
  } else if (deliveryState && merchantState && deliveryState === merchantState) {
    return 80;
  } else {
    return 120;
  }
};

/**
 * Preview/get return charge for a courier order (User side)
 */
export const getCourierOrderReturnCharge = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.userId;

  try {
    const order = await CourierOrder.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    const returnCharge = calculateReturnCharge(order.deliveryLocation, merchant.address);

    return res.status(200).json({ success: true, returnCharge });
  } catch (err) {
    console.error("Get courier order return charge error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Submit return request for items on a delivered courier order (User side)
 */
export const requestCourierOrderReturn = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.userId;
  const { items, reason, faultType } = req.body;

  let parsedItems = items;
  if (typeof items === 'string') {
    try {
      parsedItems = JSON.parse(items);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid JSON format for items" });
    }
  }

  if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
    return res.status(400).json({ success: false, message: "Items to return are required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, message: "Return reason is required" });
  }
  if (!faultType || !['merchant_fault', 'customer_choice'].includes(faultType)) {
    return res.status(400).json({ success: false, message: "Valid faultType is required" });
  }

  try {
    const order = await CourierOrder.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
    }

    if (order.returnRequest && order.returnRequest.status !== 'none') {
      return res.status(400).json({ success: false, message: "A return request has already been initiated/processed" });
    }

    const returnItems = [];
    for (const reqItem of parsedItems) {
      const orderItem = order.items.find(
        oi => oi.productId.toString() === reqItem.productId.toString() &&
              oi.variantId.toString() === reqItem.variantId.toString()
      );
      if (!orderItem) {
        return res.status(400).json({ success: false, message: `Item with product ${reqItem.productId} not found in this order` });
      }
      if (reqItem.quantity <= 0 || reqItem.quantity > orderItem.quantity) {
        return res.status(400).json({ success: false, message: `Invalid return quantity for item ${orderItem.name}` });
      }
      returnItems.push({
        productId: orderItem.productId,
        variantId: orderItem.variantId,
        name: orderItem.name,
        quantity: reqItem.quantity,
        price: orderItem.price,
        size: orderItem.size,
        image: orderItem.image
      });
    }

    // Upload return evidence images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `flashfits/courier-returns/${orderId}`,
              resource_type: "image",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });
        uploadedImages.push(result.secure_url);
      }
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    const returnCharge = calculateReturnCharge(order.deliveryLocation, merchant.address);

    order.returnRequest = {
      status: 'pending',
      reason,
      faultType,
      returnCharge,
      items: returnItems,
      requestedAt: new Date(),
      images: uploadedImages
    };

    await order.save();

    return res.status(200).json({ success: true, message: "Return request submitted successfully", order });
  } catch (err) {
    console.error("Request courier order return error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Update courier order return status (Merchant side)
 * Supports transitioning: pending -> picked -> shipped -> received/rejected
 */
export const updateCourierOrderReturnStatus = async (req, res) => {
  const { orderId } = req.params;
  const merchantId = req.merchantId;
  const { status, rejectReason } = req.body;

  const validStatuses = ['picked', 'shipped', 'received', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid or missing status" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await CourierOrder.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.merchantId.toString() !== merchantId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this order" });
    }

    if (!order.returnRequest || order.returnRequest.status === 'none') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "No return request exists for this order" });
    }

    if (['received', 'rejected'].includes(order.returnRequest.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Return has already been processed" });
    }

    if (status === 'received') {
      // Process refund calculations
      let totalReturnItemAmount = 0;
      for (const item of order.returnRequest.items) {
        totalReturnItemAmount += item.price * item.quantity;
      }

      const isMerchantFault = order.returnRequest.faultType === 'merchant_fault';
      const returnCharge = order.returnRequest.returnCharge || 0;
      let refundAmount = totalReturnItemAmount;

      if (!isMerchantFault) {
        // Customer bears return charge (deducted from refund)
        refundAmount = Math.max(0, totalReturnItemAmount - returnCharge);
      }

      const { creditWallet, debitWallet } = await import("../../helperFns/walletHelper.js");

      if (refundAmount > 0) {
        const desc = isMerchantFault
          ? `Refund for returned items in courier order ${order._id} (merchant fault)`
          : `Refund for returned items in courier order ${order._id} (Return charge: ₹${returnCharge} deducted)`;
        await creditWallet({
          ownerType: "user",
          ownerId: order.userId,
          amount: refundAmount,
          description: desc,
          orderId: order._id,
          session
        });
      }

      if (isMerchantFault && returnCharge > 0) {
        await debitWallet({
          ownerType: "merchant",
          ownerId: order.merchantId,
          amount: returnCharge,
          description: `Return charge for merchant-fault return in courier order ${order._id}`,
          orderId: order._id,
          session,
          allowNegative: true
        });
      }

      order.returnRequest.status = 'received';
      order.returnRequest.processedAt = new Date();
      order.orderStatus = 'returned';
      order.customerDeliveryStatus = 'returned';
      order.paymentStatus = 'refunded';

    } else if (status === 'rejected') {
      order.returnRequest.status = 'rejected';
      order.returnRequest.processedAt = new Date();
      if (rejectReason) {
        order.returnRequest.reason = `${order.returnRequest.reason} (Rejected reason: ${rejectReason})`;
      }
    } else {
      // Just update status to picked or shipped
      order.returnRequest.status = status;
    }

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, message: `Return status updated to ${status}`, order });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Update courier order return status error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
