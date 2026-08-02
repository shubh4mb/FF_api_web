import mongoose from 'mongoose';

/**
 * WarehouseOrder
 *
 * Orders fulfilled from a FlashFits warehouse.
 * Two fulfillment types:
 *   - 'try_and_buy': rider picks from warehouse, brings to customer (T&B flow)
 *   - 'courier': packed and shipped via courier partner
 *
 * Commission accounting:
 *   - totalAmount: full item value
 *   - commissionAmount: FF's cut (commissionRate% of totalAmount)
 *   - merchantPayout: totalAmount - commissionAmount → added to merchant's WeeklyPayout
 */

const WarehouseOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Which warehouse fulfills this order
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    warehouseDetails: {
      name: { type: String, default: null },
      code: { type: String, default: null },
    },

    // The merchant whose inventory is being sold (consignment owner)
    sourceMerchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    merchantDetails: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
    },

    fulfillmentType: {
      type: String,
      enum: ['try_and_buy', 'courier'],
      required: true,
    },

    // Order items (referencing WarehouseProduct)
    items: [
      {
        warehouseProductId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
        variantId: { type: mongoose.Schema.Types.ObjectId },
        name: String,
        quantity: Number,
        price: Number,
        size: String,
        image: String,
        // T&B fields
        tryStatus: {
          type: String,
          enum: ['pending', 'accepted', 'returned', 'not-triable'],
          default: 'pending',
        },
        returnReason: { type: String, default: null },
      },
    ],

    // ── Financials ──
    totalAmount: { type: Number, default: 0 },         // sum of item prices
    commissionRate: { type: Number, default: 0 },       // % applied
    commissionAmount: { type: Number, default: 0 },     // ₹ FF retains
    merchantPayout: { type: Number, default: 0 },       // ₹ going to merchant

    finalBilling: {
      baseAmount: { type: Number, default: 0 },
      tryAndBuyFee: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      serviceGST: { type: Number, default: 0 },
      deliveryTip: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      deliveryCharge: { type: Number, default: 0 },
      totalPayable: { type: Number, default: 0 },
    },

    deliveryCharge: { type: Number, default: 0 },
    returnCharge: { type: Number, default: 0 },
    originalDeliveryCharge: { type: Number, default: 0 },
    originalReturnCharge: { type: Number, default: 0 },
    waitingTimeCharge: { type: Number, default: 0 },
    deliveryDistance: { type: Number, default: 0 },
    estimatedTime: { type: Number, default: 0 },

    appliedOffers: [
      {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
        title: String,
        scope: { type: String, enum: ['admin', 'merchant'] },
        discountType: { type: String, enum: ['flat', 'percentage'] },
        discountValue: Number,
        discountApplied: Number,
        freeDelivery: { type: Boolean, default: false },
      },
    ],

    // ── Status (mirrors Order for T&B, CourierOrder for courier) ──
    orderStatus: {
      type: String,
      enum: [
        // Shared
        'pending', 'placed', 'accepted', 'packed', 'cancelled', 'rejected',
        // T&B specific
        'in_transit', 'try_phase', 'selection_made', 'return_in_progress', 'completed',
        // Courier specific
        'confirmed', 'shipped', 'delivered', 'returned',
      ],
      default: 'placed',
    },
    customerDeliveryStatus: {
      type: String,
      enum: [
        'placed', 'accepted', 'on_the_way', 'try_your_fits',
        'awaiting_payment', 'completed', 'cancelled',
        'shipped', 'delivered', 'returned',
      ],
      default: 'placed',
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'delivery_fee_paid', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'cod'],
      default: 'online',
    },

    // ── Delivery (T&B) ──
    deliveryRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryRider',
      default: null,
    },
    deliveryRiderDetails: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
    },
    deliveryRiderStatus: {
      type: String,
      enum: [
        'unassigned', 'queued', 'assigned', 'en_route_pickup', 'at_pickup',
        'picked_up', 'en_route_delivery', 'at_delivery', 'try_phase',
        'returning', 'at_merchant_return', 'completed', 'cancelled',
      ],
      default: 'unassigned',
    },
    otp: { type: String, default: null },
    trialPhaseStart: { type: Date, default: null },
    trialPhaseEnd: { type: Date, default: null },
    trialPhaseDuration: { type: Number, default: 0 },
    overtimePenalty: { type: Number, default: 0 },

    // ── Locations ──
    deliveryLocation: {
      name: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      area: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
      addressType: String,
      deliveryInstructions: String,
      coordinates: { type: [Number], index: '2dsphere' }, // [lng, lat]
    },
    // Pickup = warehouse address (set at order creation time)
    pickupLocation: {
      coordinates: { type: [Number], index: '2dsphere' }, // [lng, lat]
    },

    // ── Courier (when fulfillmentType = 'courier') ──
    trackingDetails: {
      trackingId: { type: String, default: null },
      courierPartner: { type: String, default: null },
      trackingUrl: { type: String, default: null },
      estimatedDelivery: { type: Date, default: null },
    },
    deliveredAt: { type: Date, default: null },

    returnRequest: {
      status: {
        type: String,
        enum: ['none', 'pending', 'picked', 'shipped', 'received', 'rejected'],
        default: 'none',
      },
      reason: { type: String, default: null },
      items: [
        {
          warehouseProductId: { type: mongoose.Schema.Types.ObjectId },
          name: String,
          quantity: Number,
          price: Number,
          size: String,
          image: String,
        },
      ],
      requestedAt: { type: Date, default: null },
    },

    // ── Photos ──
    returnPhotos: [
      {
        url: { type: String },
        public_id: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    packingPhotos: [
      {
        url: { type: String },
        public_id: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Razorpay ──
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },

    // ── Settlement ──
    settlementStatus: {
      type: String,
      enum: ['unsettled', 'settled', 'failed'],
      default: 'unsettled',
    },

    reason: { type: String, default: null },
    cancellationRequest: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    cancellationRequestReason: { type: String, default: null },
  },
  { timestamps: true }
);

// ── Indexes ──
WarehouseOrderSchema.index({ userId: 1, createdAt: -1 });
WarehouseOrderSchema.index({ warehouseId: 1, orderStatus: 1 });
WarehouseOrderSchema.index({ sourceMerchantId: 1, orderStatus: 1 }); // merchant dashboard
WarehouseOrderSchema.index({ deliveryRiderId: 1, orderStatus: 1 });
WarehouseOrderSchema.index({ orderStatus: 1, createdAt: -1 });
WarehouseOrderSchema.index({ settlementStatus: 1 });

export default mongoose.model('WarehouseOrder', WarehouseOrderSchema);
