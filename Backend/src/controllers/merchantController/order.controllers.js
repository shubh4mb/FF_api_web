import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { getIO } from "../../config/socket.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import { assignNearestRider } from "../../helperFns/deliveryRiderFns.js";
import { enqueueOrder } from '../../helperFns/orderFns.js';
import Merchant from "../../models/merchant.model.js";
import { creditWallet } from "../../helperFns/walletHelper.js";
import { notifyOrderEvent } from "../../helperFns/notificationHelper.js";
import { inferZone } from "../../utils/zoneInfer.js";

const generateOTP = () => Math.floor(1000 + Math.random() * 9000);

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
  console.log(req.merchantId,"sdadasd");
  const orders = await Order.find({ merchantId: req.merchantId, orderStatus: "placed" })
    .select('orderStatus items totalAmount deliveryRiderStatus createdAt deliveryLocation userId')
    .sort({ createdAt: -1 })
    .lean();
  return res.status(200).json({ orders });
};


export const orderRequestForMerchant = async (req, res) => {
  const io = getIO();
  let queueResult = null; // ← Declare here, outside any block

  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId).populate('merchantId', 'shopName address');
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (status === "accept") {
      order.orderStatus = "accepted";

      // Validate that order has required coordinates
      if (!order.pickupLocation?.coordinates?.length || !order.deliveryLocation?.coordinates?.length) {
        return res.status(400).json({ message: "Order missing pickup or delivery coordinates" });
      }

      const pickupCoordinates = order.pickupLocation.coordinates;
      const pickupLocation = {
        lat: pickupCoordinates[1],
        lng: pickupCoordinates[0],
      };

      const customerCoordinates = order.deliveryLocation.coordinates;
      const customerLocation = {
        lat: customerCoordinates[1],
        lng: customerCoordinates[0],
      };

      const merchant = await Merchant.findById(order.merchantId);
      // Dynamic zone inference ensures perfect sync with Rider's inference
      const zoneId = await inferZone(pickupLocation.lat, pickupLocation.lng);

      queueResult = await enqueueOrder({
        orderId: order._id.toString(),
        merchantId: order.merchantId.toString(),
        zoneId,
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        customerLat: customerLocation.lat,
        customerLng: customerLocation.lng,
      });

      if (queueResult.success) {
        order.deliveryRiderStatus = "queued";
        order.queuedZone = queueResult.zoneId;
      } else {
        order.deliveryRiderStatus = "unassigned";
      }

      const emitPayload = {
        orderId,
        orderStatus: order.orderStatus,
        deliveryRiderStatus: order.deliveryRiderStatus,
        queuedZone: queueResult?.zoneId,
        merchantId: order.merchantId,
      };

      io.in(`merchant:${order.merchantId}`).socketsJoin(orderId);
      io.to(`merchant:${order.merchantId}`).emit("orderUpdate", emitPayload);
      io.to(orderId).emit("orderUpdate", emitPayload);

      // 📱 Customer notification: "Order Confirmed" (selective milestone #2)
      notifyOrderEvent("customer", "order_accepted", {
        userId: order.userId,
        orderId: order._id,
      });
    }

    if (status === "reject") {
      order.orderStatus = "rejected";
      order.reason = req.body.reason || "Merchant rejected the order";

      // 💰 Refund full upfront amount to customer wallet
      const refundAmount = (order.deliveryCharge || 0) + (order.returnCharge || 0) + (order.finalBilling?.deliveryTip || 0) + (order.finalBilling?.serviceGST || 0);

      if (refundAmount > 0) {
        await creditWallet({
          ownerType: "user",
          ownerId: order.userId,
          amount: refundAmount,
          description: `Refund: Merchant declined order #${orderId.toString().slice(-5).toUpperCase()}`,
          orderId: order._id,
        });
        order.paymentStatus = "refunded";

        // 📱 Customer notification: "Refund credited"
        notifyOrderEvent("customer", "order_rejected", {
          userId: order.userId,
          orderId: order._id,
          amount: refundAmount,
        });
      } else {
        notifyOrderEvent("customer", "order_rejected", {
          userId: order.userId,
          orderId: order._id,
        });
      }
    }

    await order.save();
    emitOrderUpdate(io, orderId, order);
    console.log(order,'order');
    return res.status(200).json({
      message: status === "reject"
        ? `Order rejected. ₹${order.deliveryCharge || 0} refunded to customer wallet.`
        : "Order accepted & queued for rider.",
      orderId,
      order,
      queuedZone: status === "accept" && queueResult?.success ? queueResult.zoneId : undefined,
    });

  } catch (err) {
    console.error("Error in orderRequestForMerchant:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const getAllOrder = async (req, res) => {
  try {
    const orders = await Order.find({ merchantId: req.merchantId })
      .select('orderStatus items totalAmount deliveryRiderStatus createdAt deliveryRiderDetails deliveryLocation userId otp')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders" });
  }
}

export const orderPacked = async (req, res) => {
  const io = getIO();
  const { orderId } = req.params;
  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.orderStatus = "packed";
    order.otp = generateOTP();
    await order.save();
    emitOrderUpdate(io, orderId, order);

    // 📱 Rider notification: "Order packed, ready for pickup"
    if (order.deliveryRiderId) {
      notifyOrderEvent("rider", "pickup_ready", {
        riderId: order.deliveryRiderId,
        orderId: order._id,
      });
    }

    return res.status(200).json({ message: "Order packed & OTP generated", otp: order.otp });
  } catch (error) {
    return res.status(500).json({ message: "Error updating order status" });
  }
}









