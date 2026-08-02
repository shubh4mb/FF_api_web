import WarehouseOrder from '../../models/warehouseOrder.model.js';
import Product from '../../models/product.model.js';
import Warehouse from '../../models/warehouse.model.js';
import Cart from '../../models/cart.model.js';
import CourierCart from '../../models/courierCart.model.js';
import Address from '../../models/address.model.js';
import AppConfig from '../../models/appConfig.model.js';
import { calculateDeliveryCharge } from '../../helperFns/deliveryChargeFns.js';
import { isWithinTBRadius } from '../../helperFns/geoHelpers.js';
import razorpay from '../../config/RazorPay.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Helper: resolve the effective commission rate for a warehouse order.
 * Priority chain: product.commissionRate → warehouse.commissionRate → appConfig.defaultWarehouseCommissionRate
 */
const resolveCommissionRate = (product, warehouse, config) => {
  if (product.commissionRate !== null && product.commissionRate !== undefined) {
    return product.commissionRate;
  }
  if (warehouse.commissionRate !== null && warehouse.commissionRate !== undefined) {
    return warehouse.commissionRate;
  }
  return config.defaultWarehouseCommissionRate ?? 10;
};

/**
 * POST /user/warehouse/orders/create
 * Place a warehouse T&B order.
 * 
 * Checkout flow:
 * 1. Filter cart for warehouse items (source === 'warehouse')
 * 2. Validate stock
 * 3. Calculate delivery from warehouse coords → user address
 * 4. Calculate commission + merchant payout
 * 5. Create Razorpay order (upfront delivery fee)
 * 6. Create WarehouseOrder in DB
 * 7. Reserve stock
 */
export const createWarehouseTBOrder = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { addressId, deliveryTip = 0, warehouseId, paymentMethod = 'online' } = req.body;

  if (!addressId || !warehouseId) {
    throw new ApiError(400, 'addressId and warehouseId are required');
  }

  // ── 1. Cart ──
  const cart = await Cart.findOne({ userId }).lean();
  if (!cart || !cart.items.length) {
    throw new ApiError(400, 'Your cart is empty');
  }

  const warehouseItems = cart.items.filter(
    (i) => i.source === 'warehouse' && i.warehouseId?.toString() === warehouseId
  );

  if (!warehouseItems.length) {
    throw new ApiError(400, 'No warehouse items found for this warehouse in your cart');
  }

  // ── 2. Validate warehouse ──
  const warehouse = await Warehouse.findOne({ _id: warehouseId, isActive: true });
  if (!warehouse) throw new ApiError(404, 'Warehouse not found or inactive');
  if (!warehouse.supportsTryAndBuy) {
    throw new ApiError(400, 'This warehouse does not support Try & Buy');
  }

  // ── 3. Validate address ──
  const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
  if (!deliveryAddress) throw new ApiError(404, 'Delivery address not found');

  const userCoords = deliveryAddress.location.coordinates;
  const warehouseCoords = warehouse.address.location.coordinates;

  // ── 4. Config + delivery charge ──
  const config = await AppConfig.getConfig();
  const { roadDistanceKm, deliveryCharge, returnCharge, estimatedTime } =
    await calculateDeliveryCharge({
      userCoords,
      merchantCoords: warehouseCoords, // reuse the same helper — warehouse is the pickup point
      deliveryPerKmRate: config.deliveryPerKmRate,
      returnPerKmRate: config.returnPerKmRate,
      waitingCharge: config.waitingCharge,
    });

  if (roadDistanceKm > config.tryAndBuyRadius) {
    return res.status(400).json({
      success: false,
      serviceable: false,
      message: `Try & Buy from warehouse is not available. The warehouse is ${roadDistanceKm.toFixed(1)} km away (limit: ${config.tryAndBuyRadius} km).`,
    });
  }

  // ── 5. Validate stock + build order items ──
  let totalAmount = 0;
  const orderItems = [];

  for (const cartItem of warehouseItems) {
    const whProduct = await Product.findOne({
      _id: cartItem.warehouseProductId,
      isActive: true,
      isVerified: true,
    });
    if (!whProduct) continue;

    const variant = whProduct.variants.id(cartItem.variantId);
    if (!variant) continue;

    const sizeObj = variant.sizes.find((s) => s.size === cartItem.size);
    if (!sizeObj) continue;

    const available = sizeObj.stock - (sizeObj.reservedStock || 0);
    if (available < cartItem.quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for ${whProduct.name} (Size: ${cartItem.size}). Available: ${available}`
      );
    }

    for (let i = 0; i < cartItem.quantity; i++) {
      totalAmount += variant.price;
      orderItems.push({
        warehouseProductId: whProduct._id,
        variantId: cartItem.variantId,
        name: whProduct.name,
        quantity: 1,
        price: variant.price,
        size: cartItem.size,
        image: cartItem.image?.url || '',
        tryStatus: whProduct.isTriable ? 'pending' : 'not-triable',
      });
    }
  }

  if (!orderItems.length) throw new ApiError(400, 'No valid items to order');

  // ── 6. Commission calculation ──
  // Use the first warehouse product's commission rate as representative
  // (all items from same warehouse, rates should be consistent or averaged)
  const firstProduct = await Product.findById(warehouseItems[0].warehouseProductId);
  const commissionRate = resolveCommissionRate(firstProduct, warehouse, config);
  const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const merchantPayout = totalAmount - commissionAmount;

  // ── 7. Payment ──
  const serviceGST = 0;
  const upfrontPayable = Math.round(deliveryCharge + returnCharge + deliveryTip + serviceGST);
  const finalPayable = Math.round(totalAmount + upfrontPayable);

  let razorpayOrderId = `free_${Date.now()}`;
  let paymentStatus = 'delivery_fee_paid';

  if (upfrontPayable > 0 && paymentMethod === 'online') {
    const razorpayOrder = await razorpay.orders.create({
      amount: upfrontPayable * 100,
      currency: 'INR',
      receipt: `wh_receipt_${Date.now()}`,
      payment_capture: 1,
    });
    razorpayOrderId = razorpayOrder.id;
    paymentStatus = 'pending';
  }

  // ── 8. Create WarehouseOrder ──
  const pendingOrder = new WarehouseOrder({
    userId,
    warehouseId: warehouse._id,
    warehouseDetails: { name: warehouse.name, code: warehouse.code },
    sourceMerchantId: firstProduct.sourceMerchantId,
    merchantDetails: {
      name: null, // populated below
      phone: null,
    },
    fulfillmentType: 'try_and_buy',
    items: orderItems,
    totalAmount,
    commissionRate,
    commissionAmount,
    merchantPayout,
    finalBilling: {
      baseAmount: totalAmount,
      deliveryTip,
      serviceGST,
      totalPayable: finalPayable,
    },
    deliveryCharge,
    originalDeliveryCharge: deliveryCharge,
    returnCharge,
    originalReturnCharge: returnCharge,
    deliveryDistance: roadDistanceKm,
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
      coordinates: userCoords,
    },
    // Pickup = warehouse address (not a merchant shop!)
    pickupLocation: { coordinates: warehouseCoords },
    razorpayOrderId,
    paymentStatus,
    orderStatus: paymentStatus === 'delivery_fee_paid' ? 'placed' : 'pending',
    paymentMethod,
  });

  await pendingOrder.save();

  // ── 9. Reserve stock ──
  for (const cartItem of warehouseItems) {
    await Product.updateOne(
      {
        _id: cartItem.warehouseProductId,
        'variants._id': cartItem.variantId,
        'variants.sizes.size': cartItem.size,
      },
      {
        $inc: { 'variants.$[v].sizes.$[s].reservedStock': cartItem.quantity },
      },
      {
        arrayFilters: [{ 'v._id': cartItem.variantId }, { 's.size': cartItem.size }],
      }
    );
  }

  return res.status(201).json({
    success: true,
    orderId: pendingOrder._id,
    razorpayOrderId,
    totalAmount,
    upfrontPayable,
    finalPayable,
    deliveryCharge,
    returnCharge,
    commissionRate,
  });
});

/**
 * POST /user/warehouse/orders/courier/create
 * Place a warehouse Courier order (no rider — ships via courier partner).
 */
export const createWarehouseCourierOrder = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { addressId, warehouseId, paymentMethod = 'online' } = req.body;

  if (!addressId || !warehouseId) {
    throw new ApiError(400, 'addressId and warehouseId are required');
  }

  const cart = await CourierCart.findOne({ userId }).lean();
  if (!cart || !cart.items.length) throw new ApiError(400, 'Your courier cart is empty');

  const warehouseItems = cart.items.filter(
    (i) => i.source === 'warehouse' && i.warehouseId?.toString() === warehouseId
  );

  if (!warehouseItems.length) {
    throw new ApiError(400, 'No warehouse items in your courier cart for this warehouse');
  }

  const warehouse = await Warehouse.findOne({ _id: warehouseId, isActive: true });
  if (!warehouse) throw new ApiError(404, 'Warehouse not found');
  if (!warehouse.supportsCourier) throw new ApiError(400, 'This warehouse does not support courier delivery');

  const deliveryAddress = await Address.findOne({ _id: addressId, user: userId });
  if (!deliveryAddress) throw new ApiError(404, 'Delivery address not found');

  const config = await AppConfig.getConfig();

  // Standard courier delivery charge (flat for now)
  const deliveryCharge = 40;

  // Build items + total
  let totalAmount = 0;
  const orderItems = [];

  for (const cartItem of warehouseItems) {
    const whProduct = await Product.findOne({
      _id: cartItem.warehouseProductId,
      isActive: true,
      isVerified: true,
    });
    if (!whProduct) continue;

    const variant = whProduct.variants.id(cartItem.variantId);
    if (!variant) continue;

    const sizeObj = variant.sizes.find((s) => s.size === cartItem.size);
    if (!sizeObj) continue;

    const available = sizeObj.stock - (sizeObj.reservedStock || 0);
    if (available < cartItem.quantity) {
      throw new ApiError(400, `Insufficient stock for ${whProduct.name} (${cartItem.size}). Available: ${available}`);
    }

    totalAmount += variant.price * cartItem.quantity;
    orderItems.push({
      warehouseProductId: whProduct._id,
      variantId: cartItem.variantId,
      name: whProduct.name,
      quantity: cartItem.quantity,
      price: variant.price,
      size: cartItem.size,
      image: cartItem.image?.url || '',
      tryStatus: 'not-triable',
    });
  }

  if (!orderItems.length) throw new ApiError(400, 'No valid items');

  const firstProduct = await Product.findById(warehouseItems[0].warehouseProductId);
  const commissionRate = resolveCommissionRate(firstProduct, warehouse, config);
  const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const merchantPayout = totalAmount - commissionAmount;

  const totalPayable = totalAmount + deliveryCharge;

  // Create Razorpay order
  let razorpayOrderId = `free_courier_${Date.now()}`;
  let paymentStatus = 'paid';

  if (paymentMethod === 'online') {
    const razorpayOrder = await razorpay.orders.create({
      amount: totalPayable * 100,
      currency: 'INR',
      receipt: `wh_courier_${Date.now()}`,
      payment_capture: 1,
    });
    razorpayOrderId = razorpayOrder.id;
    paymentStatus = 'pending';
  }

  const order = new WarehouseOrder({
    userId,
    warehouseId: warehouse._id,
    warehouseDetails: { name: warehouse.name, code: warehouse.code },
    sourceMerchantId: firstProduct.sourceMerchantId,
    fulfillmentType: 'courier',
    items: orderItems,
    totalAmount,
    commissionRate,
    commissionAmount,
    merchantPayout,
    finalBilling: { baseAmount: totalAmount, deliveryCharge, totalPayable },
    deliveryCharge,
    pickupLocation: { coordinates: warehouse.address.location.coordinates },
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
      coordinates: deliveryAddress.location.coordinates,
    },
    orderStatus: paymentMethod === 'cod' ? 'placed' : 'pending',
    paymentStatus,
    paymentMethod,
    razorpayOrderId,
  });

  await order.save();

  // Reserve stock
  for (const cartItem of warehouseItems) {
    await Product.updateOne(
      {
        _id: cartItem.warehouseProductId,
        'variants._id': cartItem.variantId,
        'variants.sizes.size': cartItem.size,
      },
      { $inc: { 'variants.$[v].sizes.$[s].reservedStock': cartItem.quantity } },
      { arrayFilters: [{ 'v._id': cartItem.variantId }, { 's.size': cartItem.size }] }
    );
  }

  return res.status(201).json({
    success: true,
    orderId: order._id,
    razorpayOrderId,
    totalAmount,
    deliveryCharge,
    totalPayable,
    commissionRate,
  });
});

/**
 * POST /user/warehouse/orders/verify-payment
 * Verify Razorpay payment and mark warehouse order as placed.
 */
export const verifyWarehousePayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

  const order = await WarehouseOrder.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  // Verify signature
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature !== razorpaySignature) {
    order.paymentStatus = 'failed';
    await order.save();
    throw new ApiError(400, 'Payment verification failed');
  }

  order.razorpayPaymentId = razorpayPaymentId;
  order.paymentStatus = order.fulfillmentType === 'courier' ? 'paid' : 'delivery_fee_paid';
  order.orderStatus = 'placed';
  await order.save();

  return res.status(200).json({ success: true, orderId: order._id, orderStatus: order.orderStatus });
});

/**
 * GET /user/warehouse/orders/my-orders
 * Get the authenticated user's warehouse orders.
 */
export const getMyWarehouseOrders = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { fulfillmentType, page = 1, limit = 10 } = req.query;

  const filter = { userId };
  if (fulfillmentType) filter.fulfillmentType = fulfillmentType;

  const skip = (Number(page) - 1) * Number(limit);

  const orders = await WarehouseOrder.find(filter)
    .populate('warehouseId', 'name code')
    .populate('sourceMerchantId', 'shopName logo')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return res.status(200).json({ orders, page: Number(page), limit: Number(limit) });
});

/**
 * GET /user/warehouse/orders/:orderId
 * Get detail of a single warehouse order for the authenticated user.
 */
export const getWarehouseOrderDetail = asyncHandler(async (req, res) => {
  const order = await WarehouseOrder.findOne({
    _id: req.params.orderId,
    userId: req.user.userId,
  })
    .populate('warehouseId', 'name code address')
    .populate('sourceMerchantId', 'shopName logo')
    .populate('deliveryRiderId', 'name phone')
    .lean();

  if (!order) throw new ApiError(404, 'Order not found');

  return res.status(200).json({ order });
});
