import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { getIO } from "../../config/socket.js";


import DeliveryRider from "../../models/deliveryRider.model.js";
import { assignNearestRider } from "../../helperFns/deliveryRiderFns.js"
import { onlineMerchants } from "../../sockets/merchant.socket.js"
import { enqueueOrder } from '../../helperFns/orderFns.js'; // Your new helper—add if not
import Merchant from "../../models/merchant.model.js";

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
  const io = getIO();
  console.log(req.merchantId, 'merchantIddddd');
  const orders = await Order.find({ merchantId: req.merchantId, orderStatus: "placed" });
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

      const pickupCoordinates = order.pickupLocation?.coordinates || [76.3244129, 9.9371151];
      const pickupLocation = {
        lat: pickupCoordinates[1] ?? 9.9371151,
        lng: pickupCoordinates[0] ?? 76.3244129,
      };

      const customerCoordinates = order.deliveryLocation?.coordinates || [76.3244129, 9.9371151];
      const customerLocation = {
        lat: customerCoordinates[1] ?? 9.9371151,
        lng: customerCoordinates[0] ?? 76.3244129,
      };

      const merchant = await Merchant.findById(order.merchantId);
      const zoneId = merchant.zoneName || (await inferZone(pickupLocation.lat, pickupLocation.lng));

      // This will now safely assign to the outer-scoped queueResult
      queueResult = await enqueueOrder({
        orderId: order._id.toString(),
        merchantId: order.merchantId.toString(),
        zoneId,
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        customerLat: customerLocation.lat,
        customerLng: customerLocation.lng,
      });

      console.log(queueResult, "queueResult");

      if (queueResult.success) {
        order.deliveryRiderStatus = "queued";
        order.queuedZone = queueResult.zoneId;
        console.log(`✅ Order ${orderId} queued in zone ${queueResult.zoneId}—matcher will assign rider`);
      } else {
        console.log("❌ Queue failed—fallback to unassigned");
        order.deliveryRiderStatus = "unassigned";
      }

      // Now safe to use queueResult here too
      const emitPayload = {
        orderId,
        orderStatus: order.orderStatus,
        deliveryRiderStatus: order.deliveryRiderStatus,
        queuedZone: queueResult?.zoneId,
        merchantId: order.merchantId,
      };

      // Emit to merchant sockets
      const merchantSocketIds = onlineMerchants[order.merchantId?.toString()];
      if (merchantSocketIds && merchantSocketIds.length > 0) {
        merchantSocketIds.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.join(orderId);
            io.to(socketId).emit("orderUpdate", emitPayload);
          }
        });
      } else {
        console.log(`No active sockets for merchant ${order.merchantId}`, order.merchantId);
      }

      // Emit to order room
      io.to(orderId).emit("orderUpdate", emitPayload);
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
      queuedZone: status === "accept" && queueResult?.success ? queueResult.zoneId : undefined,
    });

  } catch (err) {
    console.error("Error in orderRequestForMerchant:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const getAllOrder = async (req, res) => {
  try {
    const orders = await Order.find({ merchantId: req.merchantId }).sort({ createdAt: -1 });
    console.log(orders.length, 'orders length');

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

    return res.status(200).json({ message: "Order status updated", order });

  } catch (error) {
    return res.status(500).json({ message: "Error updating order status" });
  }
}









