import CourierOrder from "../../models/courierOrder.model.js";
import CourierCart from "../../models/courierCart.model.js";
import Merchant from "../../models/merchant.model.js";
import Product from "../../models/product.model.js";
import Address from "../../models/address.model.js";
import mongoose from "mongoose";
import { findBestOffers, recordOfferUsage } from '../../services/offerEngine.js';

const COURIER_DELIVERY_CHARGE = 40;

/**
 * 1. Initiate Courier Order (Mock payment creation)
 * Validates cart and address, calculates billing, returns mock Razorpay ID.
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
    if (!merchant.enableCourierDelivery) {
      return res.status(400).json({ success: false, message: `Merchant ${merchantId} does not support courier delivery.` });
    }

    // 2. Validate Address
    const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
    if (!deliveryAddress) {
      return res.status(404).json({ success: false, message: "Delivery address not found" });
    }

    // 3. Get Courier Cart Items
    const cart = await CourierCart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Courier cart is empty" });
    }

    const merchantItems = cart.items.filter(
      item => item.merchantId && item.merchantId.toString() === merchantId.toString()
    );

    if (merchantItems.length === 0) {
      // For debugging, let's see what merchantIds are in the cart
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

    const serviceGST = parseFloat(((COURIER_DELIVERY_CHARGE + deliveryTip) * 0.18).toFixed(2));

    // === COMPUTE BEST OFFERS ===
    let appliedOffers = [];
    let offerDiscount = 0;
    try {
      const merchantTotals = {};
      merchantTotals[merchantId.toString()] = totalAmount;

      const bestOffers = await findBestOffers(
        userId,
        { items: orderItems, subtotal: totalAmount, merchantTotals },
        req.body.couponCode || null
      );

      if (bestOffers.adminOffer) {
        appliedOffers.push({
          offerId: bestOffers.adminOffer._id,
          title: bestOffers.adminOffer.title,
          scope: 'admin',
          discountType: bestOffers.adminOffer.discountType,
          discountValue: bestOffers.adminOffer.discountValue,
          discountApplied: bestOffers.adminOffer.discountAmount,
        });
        offerDiscount += bestOffers.adminOffer.discountAmount;
      }
      if (bestOffers.merchantOffer) {
        appliedOffers.push({
          offerId: bestOffers.merchantOffer._id,
          title: bestOffers.merchantOffer.title,
          scope: 'merchant',
          discountType: bestOffers.merchantOffer.discountType,
          discountValue: bestOffers.merchantOffer.discountValue,
          discountApplied: bestOffers.merchantOffer.discountAmount,
        });
        offerDiscount += bestOffers.merchantOffer.discountAmount;
      }
    } catch (offerErr) {
      console.error('Offer engine error (non-blocking):', offerErr.message);
    }

    const totalPayable = totalAmount - offerDiscount + COURIER_DELIVERY_CHARGE + serviceGST + deliveryTip;

    // 5. Create Pending Courier Order
    const mockRazorpayOrderId = `order_mock_${Date.now()}`;
    
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
      razorpayOrderId: mockRazorpayOrderId,
      paymentStatus: 'pending',
      orderStatus: 'placed',
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

    res.status(200).json({
      success: true,
      message: "Order initiated",
      razorpayOrderId: mockRazorpayOrderId,
      totalPayable,
      orderId: courierOrder._id,
    });

  } catch (err) {
    console.error("Initiate courier order error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * 2. Verify Courier Payment (Mock)
 * Finalizes the order and clears items from Courier Cart.
 */
export const verifyCourierOrderPayment = async (req, res) => {
  const userId = req.user.userId;
  const { razorpayOrderId, razorpayPaymentId } = req.body;

  if (!razorpayOrderId) {
    return res.status(400).json({ success: false, message: "razorpayOrderId is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await CourierOrder.findOne({ razorpayOrderId, userId }).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus === 'paid') {
      await session.commitTransaction();
      return res.status(200).json({ success: true, message: "Already paid", orderId: order._id });
    }

    // 1. Update Order Status
    order.paymentStatus = 'paid';
    order.razorpayPaymentId = razorpayPaymentId || `pay_mock_${Date.now()}`;
    order.orderStatus = 'confirmed';
    await order.save({ session });

    // 2. Clear Items from Courier Cart
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
      message: "Payment verified successfully",
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
