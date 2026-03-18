import mongoose from "mongoose";
const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
  merchantDetails: {
    name: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      default: null
    },
  },

  deliveryRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryRider', default: null },
  deliveryRiderDetails: {
    name: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      default: null
    },
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
      tryStatus: {
        type: String,
        enum: ['pending', 'accepted', 'returned', 'not-triable'],
        default: 'pending'  // For Try & Buy
      },
      returnReason: {
        type: String,
        default: null
      }
    }
  ],
  totalAmount: Number,
  orderStatus: {
    type: String,
    enum: [
      'placed',
      'accepted',
      'packed',
      'out_for_delivery',
      'arrived at delivery',
      'try phase',
      'completed try phase',
      'otp-verified-return',
      'reached return merchant',
      'merchant-return-otp-verified',
      'confirmed_purchase',
      'returned',
      'partially_returned',
      'delivered',
      'cancelled',
      'completed',
      'rejected'
    ],
    default: 'placed'
  },
  customerDeliveryStatus: {
    type: String,
    enum: [
      'trial_phase_ended',
      'completed',
      'cancelled',
      'rejected',
      'placed'
    ],
    default: 'placed'
  },
  reason: {
    type: String,
    default: null
  },
  deliveryRiderStatus: {
    type: String,
    enum: [
      'queued',
      'unassigned',               // Initial state
      'assigned',                 // Delivery boy assigned
      'en route to pickup',       // On the way to merchant
      'arrived at pickup',        // Reached merchant location
      'picked & verified order',          // Order picked
      'en route to delivery',     // Going to customer
      'arrived at delivery',      // Reached customer location
      // 'waiting for customer',     // Waiting while user tries (Try & Buy)
      'try phase',    // Try phase ongoing
      'waiting for customer selection', // Timer ended, awaiting customer item choice
      'completed try phase',
      'otp-verified-return',     // Delivery boy marks try phase completed
      'reached return merchant',
      'confirmed return',         // Items returned
      'confirmed purchase',       // Customer accepted items
      'delivered',
      'completed',               // Final confirmation
      'cancelled',                // Cancelled for any reason
    ],
    default: 'unassigned'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'delivery_fee_paid', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  finalBilling: {
    baseAmount: { type: Number, default: 0 },     // Sum of accepted items
    tryAndBuyFee: { type: Number, default: 0 },   // Optional fixed or % fee
    gst: { type: Number, default: 0 },            // GST or tax
    discount: { type: Number, default: 0 },       // Promo/coupon if any
    deliveryCharge: { type: Number, default: 0 }, // Optional
    totalPayable: { type: Number, default: 0 }    // Final amount to be paid
  },
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
      // required: true
    }
  },
  pickupLocation: {
    coordinates: {
      type: [Number], // [longitude, latitude] 
      index: "2dsphere"
    }
  },
  deliveryDistance: {
    type: Number,
    default: 0
  },
  estimatedTime: {
    type: Number,
    default: 0
  },
  deliveryCharge: { type: Number, default: 0 },
  deliveryTracking: [
    {
      timestamp: Date,
      status: String,
      location: [Number] // optional: live tracking points
    }
  ],
  returnCharge: { type: Number, default: 0 },
  otp: {
    type: String,
    default: null
  },
  returnPhotos: [
    {
      url: { type: String },
      public_id: { type: String },
      itemId: { type: mongoose.Schema.Types.ObjectId },
      uploadedAt: { type: Date, default: Date.now },
    }
  ],
  trialPhaseStart: { type: Date, default: null },
  trialPhaseEnd: { type: Date, default: null },
  trialPhaseDuration: { type: Number, default: 0 },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },

}, { timestamps: true });

// ── Performance Indexes ──
OrderSchema.index({ userId: 1, createdAt: -1 });              // Customer: "My Orders"
OrderSchema.index({ merchantId: 1, orderStatus: 1 });         // Merchant dashboard
OrderSchema.index({ deliveryRiderId: 1, orderStatus: 1 });    // Rider active order
OrderSchema.index({ orderStatus: 1, createdAt: -1 });         // Admin / queue

export default mongoose.model("Order", OrderSchema);
