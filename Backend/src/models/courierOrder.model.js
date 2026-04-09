import mongoose from "mongoose";

const CourierOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  merchantDetails: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
  },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      variantId: { type: mongoose.Schema.Types.ObjectId },
      name: String,
      quantity: Number,
      price: Number,
      size: String,
      image: String,
    }
  ],
  // --- Billing Details ---
  totalAmount: { type: Number, required: true }, // Subtotal of products
  deliveryCharge: { type: Number, default: 40 },
  gst: { type: Number, default: 0 },
  serviceGST: { type: Number, default: 0 },
  deliveryTip: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalPayable: { type: Number, required: true },

  appliedOffers: [{
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    title: String,
    scope: { type: String, enum: ['admin', 'merchant'] },
    discountType: { type: String, enum: ['flat', 'percentage'] },
    discountValue: Number,
    discountApplied: Number,
  }],

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
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: "2dsphere",
    }
  },
  orderStatus: {
    type: String,
    enum: [
      'placed',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
      'returned'
    ],
    default: 'placed'
  },
  customerDeliveryStatus: {
    type: String,
    enum: ['placed', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'placed'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  trackingDetails: {
    trackingId: { type: String, default: null },
    courierPartner: { type: String, default: null },
    trackingUrl: { type: String, default: null },
    estimatedDelivery: { type: Date, default: null },
  },
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  settlementStatus: {
    type: String,
    enum: ['unsettled', 'settled', 'failed'],
    default: 'unsettled'
  },
}, { timestamps: true });

// ── Performance Indexes ──
CourierOrderSchema.index({ userId: 1, createdAt: -1 });
CourierOrderSchema.index({ merchantId: 1, orderStatus: 1 });
CourierOrderSchema.index({ orderStatus: 1, createdAt: -1 });

export default mongoose.model("CourierOrder", CourierOrderSchema);
