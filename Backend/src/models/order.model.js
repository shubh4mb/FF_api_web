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
      'pending',                   // Razorpay order created, awaiting payment
      'placed',                    // Payment verified, awaiting merchant
      'accepted',                  // Merchant accepted
      'packed',                    // Merchant packed, rider has pickup OTP
      'in_transit',                // Rider picked up, heading to customer
      'try_phase',                 // Customer trying items
      'selection_made',            // Customer selected keep/return items & paid
      'return_in_progress',        // Rider returning items to merchant
      'completed',                 // Terminal: order done
      'cancelled',                 // Terminal: cancelled
      'rejected'                   // Terminal: merchant rejected
    ],
    default: 'placed'
  },
  customerDeliveryStatus: {
    type: String,
    enum: [
      'placed',                    // Order placed
      'accepted',                  // Merchant confirmed
      'on_the_way',                // Rider is bringing items
      'try_your_fits',             // Customer trying clothes
      'awaiting_payment',          // Customer selecting items & paying
      'completed',                 // Order complete
      'cancelled'                  // Order cancelled
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
      'unassigned',                // No rider yet
      'queued',                    // In queue, looking for rider
      'assigned',                  // Rider accepted the job
      'en_route_pickup',           // Heading to merchant
      'at_pickup',                 // Arrived at merchant
      'picked_up',                 // OTP verified, has the items
      'en_route_delivery',         // Heading to customer
      'at_delivery',               // Reached customer location
      'try_phase',                 // Waiting while customer tries
      'returning',                 // Heading back to merchant with returns
      'at_merchant_return',        // Reached merchant for return handover
      'completed',                 // Rider done, freed
      'cancelled'                  // Cancelled
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
    gst: { type: Number, default: 0 },            // GST or tax on items
    serviceGST: { type: Number, default: 0 },     // GST on service (delivery + tip)
    deliveryTip: { type: Number, default: 0 },    // Tip for delivery boy
    discount: { type: Number, default: 0 },       // Promo/coupon if any
    deliveryCharge: { type: Number, default: 0 }, // Optional
    totalPayable: { type: Number, default: 0 }    // Final amount to be paid
  },
  appliedOffers: [{
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    title: String,
    scope: { type: String, enum: ['admin', 'merchant'] },
    discountType: { type: String, enum: ['flat', 'percentage'] },
    discountValue: Number,
    discountApplied: Number,    // Actual ₹ deducted
    freeDelivery: { type: Boolean, default: false },
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
  originalDeliveryCharge: { type: Number, default: 0 },
  originalReturnCharge: { type: Number, default: 0 },
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
  overtimePenalty: { type: Number, default: 0 },
  settlementStatus: {
    type: String,
    enum: ['unsettled', 'settled', 'failed'],
    default: 'unsettled'
  },
  cancellationRequest: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none'
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cod'],
    default: 'online'
  },
  cancellationRequestReason: {
    type: String,
    default: null
  },

}, { timestamps: true });

// ── Performance Indexes ──
OrderSchema.index({ userId: 1, createdAt: -1 });              // Customer: "My Orders"
OrderSchema.index({ merchantId: 1, orderStatus: 1 });         // Merchant dashboard
OrderSchema.index({ deliveryRiderId: 1, orderStatus: 1 });    // Rider active order
OrderSchema.index({ orderStatus: 1, createdAt: -1 });         // Admin / queue

export default mongoose.model("Order", OrderSchema);
