import Order from "../../models/order.model.js";
import ProductFlat from "../../models/productFlat.model.js";
import WarehouseOrder from "../../models/warehouseOrder.model.js";
import { emitOrderUpdate } from "../../sockets/order.socket.js";
import { emitWarehouseOrderUpdate } from "../../sockets/warehouseOrder.socket.js";
import { getIO } from "../../config/socket.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import { assignNearestRider } from "../../helperFns/deliveryRiderFns.js";
import { enqueueOrder } from '../../helperFns/orderFns.js';
import Merchant from "../../models/merchant.model.js";
import { creditWallet } from "../../helperFns/walletHelper.js";
import { notifyOrderEvent } from "../../helperFns/notificationHelper.js";
import { inferZone } from "../../utils/zoneInfer.js";
import { storageService } from "../../services/storage.service.js";
import { cancelAndCleanupOrder } from "../../helperFns/orderCancellationHelper.js";

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
    const flatDoc = await ProductFlat.findById(productId).select('styleGroupId');
    const sgId = flatDoc ? flatDoc.styleGroupId : productId;
    
    await ProductFlat.updateMany(
      { $or: [{ _id: productId }, { styleGroupId: sgId }] },
      { $set: updateFields }
    );
    
    const updatedProduct = await ProductFlat.findById(productId)
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
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
  try {
    const merchant = await Merchant.findById(req.merchantId).select('accountType warehouseId');
    if (merchant?.accountType === 'warehouse' && merchant.warehouseId) {
      const orders = await WarehouseOrder.find({ warehouseId: merchant.warehouseId, orderStatus: "placed" })
        .select('orderStatus items totalAmount deliveryRiderStatus createdAt deliveryLocation userId fulfillmentType')
        .sort({ createdAt: -1 })
        .lean();
      return res.status(200).json({ orders });
    }

    const orders = await Order.find({ merchantId: req.merchantId, orderStatus: "placed" })
      .select('orderStatus items totalAmount deliveryRiderStatus createdAt deliveryLocation userId')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ orders });
  } catch (err) {
    console.error("getPlacedOrder error:", err);
    return res.status(500).json({ message: "Error fetching placed orders" });
  }
};


export const orderRequestForMerchant = async (req, res) => {
  const io = getIO();
  let queueResult = null; // ← Declare here, outside any block

  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) return res.status(404).json({ message: "Merchant not found" });

    let order = await Order.findById(orderId).populate('merchantId', 'shopName address');
    let isWarehouseOrder = false;

    if (!order && merchant.accountType === 'warehouse') {
      order = await WarehouseOrder.findById(orderId);
      if (order) isWarehouseOrder = true;
    }

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Authorization check
    if (isWarehouseOrder) {
      if (order.warehouseId.toString() !== merchant.warehouseId.toString()) {
        return res.status(403).json({ message: "Forbidden: You do not own this order" });
      }
    } else {
      if (order.merchantId._id.toString() !== req.merchantId.toString()) {
        return res.status(403).json({ message: "Forbidden: You do not own this order" });
      }
    }

    if (status === "accept" || status === "ACCEPTED") {
      order.orderStatus = (isWarehouseOrder && order.fulfillmentType === 'courier') ? 'confirmed' : 'accepted';
      order.customerDeliveryStatus = "accepted";

      if (!isWarehouseOrder || order.fulfillmentType === 'try_and_buy') {
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

        const zoneId = await inferZone(pickupLocation.lat, pickupLocation.lng);

        queueResult = await enqueueOrder({
          orderId: order._id.toString(),
          merchantId: (isWarehouseOrder ? (order.sourceMerchantId || merchant._id) : order.merchantId).toString(),
          zoneId,
          pickupLat: pickupLocation.lat,
          pickupLng: pickupLocation.lng,
          customerLat: customerLocation.lat,
          customerLng: customerLocation.lng,
          isWarehouseOrder,
        });

        if (queueResult?.success) {
          order.deliveryRiderStatus = "queued";
          order.queuedZone = queueResult.zoneId;
        } else {
          order.deliveryRiderStatus = "unassigned";
        }
      }

      const emitPayload = {
        _id: orderId,
        orderId,
        orderStatus: order.orderStatus,
        deliveryRiderStatus: order.deliveryRiderStatus,
        queuedZone: queueResult?.zoneId,
        merchantId: order.merchantId || merchant._id,
        warehouseId: order.warehouseId,
      };

      io.in(`merchant:${merchant._id}`).socketsJoin(orderId);
      io.to(`merchant:${merchant._id}`).emit("orderUpdate", emitPayload);
      if (order.warehouseId) {
        io.to(`warehouse:${order.warehouseId}`).emit("orderUpdate", emitPayload);
      }
      io.to(orderId).emit("orderUpdate", emitPayload);

      // 📱 Customer notification: "Order Confirmed" (selective milestone #2)
      notifyOrderEvent("customer", "order_accepted", {
        userId: order.userId,
        orderId: order._id,
      });
    }

    if (status === "reject" || status === "REJECTED") {
      const result = await cancelAndCleanupOrder({
        orderId,
        cancelledBy: isWarehouseOrder ? 'warehouse' : 'merchant',
        reason: req.body.reason || "Merchant rejected the order",
        action: 'rejected',
        req,
      });

      if (!result.success) {
        return res.status(result.statusCode || 400).json({ message: result.error });
      }

      return res.status(200).json({
        message: "Order rejected.",
        orderId,
        order: result.order,
      });
    }

    await order.save();
    emitOrderUpdate(io, orderId, order);
    console.log(order, 'order');
    return res.status(200).json({
      message: "Order accepted & queued for rider.",
      orderId,
      order,
      queuedZone: queueResult?.success ? queueResult.zoneId : undefined,
    });

  } catch (err) {
    console.error("Error in orderRequestForMerchant:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const getAllOrder = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchantId).select('accountType warehouseId');
    if (merchant?.accountType === 'warehouse' && merchant.warehouseId) {
      const orders = await WarehouseOrder.find({ warehouseId: merchant.warehouseId, orderStatus: { $ne: 'pending' } })
        .select('orderStatus items totalAmount deliveryRiderStatus createdAt updatedAt deliveryRiderId deliveryRiderDetails deliveryLocation userId otp cancellationRequest cancellationRequestReason riderUnresponsiveReport fulfillmentType settlementStatus')
        .sort({ createdAt: -1 })
        .lean();
      return res.status(200).json({ orders });
    }

    const orders = await Order.find({ merchantId: req.merchantId, orderStatus: { $ne: 'pending' } })
      .select('orderStatus items totalAmount deliveryRiderStatus createdAt updatedAt deliveryRiderId deliveryRiderDetails deliveryLocation userId otp cancellationRequest cancellationRequestReason riderUnresponsiveReport')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

const findOrderForMerchant = async (orderId, merchantId) => {
  const merchant = await Merchant.findById(merchantId);
  if (!merchant) return { error: "Merchant not found", status: 404 };

  let order = await Order.findById(orderId);
  let isWarehouseOrder = false;

  if (!order && merchant.accountType === 'warehouse') {
    order = await WarehouseOrder.findById(orderId);
    if (order) isWarehouseOrder = true;
  }

  if (!order) return { error: "Order not found", status: 404 };

  if (isWarehouseOrder) {
    if (order.warehouseId?.toString() !== merchant.warehouseId?.toString()) {
      return { error: "Forbidden: You do not own this order", status: 403 };
    }
  } else {
    if (order.merchantId?.toString() !== merchantId.toString()) {
      return { error: "Forbidden: You do not own this order", status: 403 };
    }
  }

  return { order, isWarehouseOrder, merchant };
};

export const requestOrderCancellation = async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  try {
    const { order, isWarehouseOrder, error, status } = await findOrderForMerchant(orderId, req.merchantId);
    if (error) return res.status(status).json({ message: error });

    const terminalStatuses = ["completed", "cancelled", "rejected"];
    if (terminalStatuses.includes(order.orderStatus)) {
      return res.status(400).json({ message: `Cannot request cancellation for order in ${order.orderStatus} state` });
    }

    order.cancellationRequest = 'pending';
    order.cancellationRequestReason = reason || "Merchant requested cancellation";
    await order.save();

    const io = getIO();
    emitOrderUpdate(io, orderId, order);
    if (isWarehouseOrder && order.warehouseId) {
      await emitWarehouseOrderUpdate(io, order.warehouseId, orderId, order);
    }

    return res.status(200).json({
      success: true,
      message: "Cancellation request submitted to admin",
      order
    });
  } catch (error) {
    console.error("Request Cancellation Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const orderPacked = async (req, res) => {
  const io = getIO();
  const { orderId } = req.params;
  try {
    const { order, isWarehouseOrder, error, status } = await findOrderForMerchant(orderId, req.merchantId);
    if (error) return res.status(status).json({ message: error });

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
    console.error("orderPacked error:", error);
    return res.status(500).json({ message: "Error updating order status" });
  }
};

export const getPackingPhotos = async (req, res) => {
  try {
    const { orderId } = req.params;
    let order = await Order.findById(orderId).select('packingPhotos items');
    if (!order) {
      order = await WarehouseOrder.findById(orderId).select('packingPhotos items');
    }
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    return res.status(200).json({ packingPhotos: order.packingPhotos || [], items: order.items });
  } catch (error) {
    console.error("Error fetching packing photos:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const uploadPackingPhoto = async (req, res) => {
  try {
    const { orderId, itemId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    if (!orderId || !itemId) {
      return res.status(400).json({ message: "orderId and itemId are required" });
    }

    let order = await Order.findById(orderId);
    if (!order) {
      order = await WarehouseOrder.findById(orderId);
    }
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify item exists in order
    const itemExists = order.items.some(item => 
      item._id?.toString() === itemId.toString() || 
      item.variantId?.toString() === itemId.toString()
    );
    if (!itemExists) {
      return res.status(400).json({ message: "Item does not belong to this order" });
    }

    // Upload to Cloudinary
    const result = await storageService.uploadSingle(req.file, "packing_proofs");
    if (!result) {
      return res.status(500).json({ message: "Failed to upload image to Cloudinary" });
    }

    // Add to order packingPhotos
    const photoObj = {
      url: result.url,
      public_id: result.public_id,
      itemId: itemId,
      uploadedAt: new Date()
    };

    order.packingPhotos = order.packingPhotos || [];
    order.packingPhotos.push(photoObj);
    await order.save();

    const io = getIO();
    emitOrderUpdate(io, orderId, order);

    return res.status(200).json({
      success: true,
      message: "Packing proof photo uploaded successfully",
      photo: photoObj
    });
  } catch (error) {
    console.error("Error uploading packing photo:", error);
    return res.status(500).json({ message: "Error uploading photo", error: error.message });
  }
};

export const deletePackingPhoto = async (req, res) => {
  try {
    const { orderId, photoId } = req.params;
    const { order, error, status } = await findOrderForMerchant(orderId, req.merchantId);
    if (error) return res.status(status).json({ message: error });

    const photo = (order.packingPhotos || []).find(p => p._id.toString() === photoId);
    if (!photo) return res.status(404).json({ message: "Photo not found" });

    // Delete from Cloudinary
    if (photo.public_id) {
      await storageService.deleteFile(photo.public_id);
    }

    // Pull from array
    order.packingPhotos.pull({ _id: photoId });
    await order.save();

    const io = getIO();
    emitOrderUpdate(io, orderId, order);

    return res.status(200).json({ success: true, message: "Photo deleted successfully" });
  } catch (error) {
    console.error("Error deleting packing photo:", error);
    return res.status(500).json({ message: "Error deleting photo", error: error.message });
  }
};

export const getPackingInfoPublic = async (req, res) => {
  try {
    const { orderId } = req.params;
    let order = await Order.findById(orderId).select('packingPhotos items orderStatus');
    if (!order) {
      order = await WarehouseOrder.findById(orderId).select('packingPhotos items orderStatus');
    }
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    return res.status(200).json({ 
      orderStatus: order.orderStatus,
      items: order.items.map(item => ({
        _id: item._id,
        name: item.name,
        size: item.size,
        image: item.image,
        quantity: item.quantity
      })),
      packingPhotos: order.packingPhotos || []
    });
  } catch (error) {
    console.error("Error fetching public packing info:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const reportUnresponsiveRider = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { order, error, status } = await findOrderForMerchant(orderId, req.merchantId);
    if (error) return res.status(status).json({ success: false, message: error });

    if (!order.deliveryRiderId) {
      return res.status(400).json({ success: false, message: "No rider assigned to this order" });
    }

    if (order.riderUnresponsiveReport?.status === 'pending') {
      return res.status(400).json({ success: false, message: "You have already reported the rider. An admin is reviewing it." });
    }

    order.riderUnresponsiveReport = {
      reportedBy: 'merchant',
      status: 'pending',
      reportedAt: new Date()
    };

    await order.save();
    return res.status(200).json({ success: true, message: "Report submitted successfully. Admin will review." });
  } catch (error) {
    console.error("Report Unresponsive Rider Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /merchant/warehouse-sales
 * Returns all warehouse orders where this merchant is the consignment source.
 * Shown as a SEPARATE section in the merchant dashboard (not mixed with shop orders).
 */
export const getMyWarehouseSales = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const { orderStatus, page = 1, limit = 20 } = req.query;

    const filter = { sourceMerchantId: merchantId };
    if (orderStatus) filter.orderStatus = orderStatus;

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      WarehouseOrder.find(filter)
        .populate('warehouseId', 'name code')
        .select(
          'orderStatus fulfillmentType items totalAmount commissionRate commissionAmount merchantPayout settlementStatus createdAt warehouseId warehouseDetails'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      WarehouseOrder.countDocuments(filter),
    ]);

    // Summary stats for merchant dashboard
    const stats = await WarehouseOrder.aggregate([
      { $match: { sourceMerchantId: merchantId } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalPayout: { $sum: '$merchantPayout' },
          totalOrders: { $sum: 1 },
          pendingSettlements: {
            $sum: { $cond: [{ $eq: ['$settlementStatus', 'unsettled'] }, 1, 0] },
          },
        },
      },
    ]);

    return res.status(200).json({
      orders,
      total,
      page: Number(page),
      limit: Number(limit),
      stats: stats[0] || { totalSales: 0, totalPayout: 0, totalOrders: 0, pendingSettlements: 0 },
    });
  } catch (error) {
    console.error('getMyWarehouseSales error:', error);
    return res.status(500).json({ message: '❌ ' + error.message });
  }
};

