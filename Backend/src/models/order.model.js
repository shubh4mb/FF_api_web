import mongoose from "mongoose";
const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
    merchantDetails:{
      name:{
        type:String,
        default:null
      },
      phone:{
        type:String,
        default:null
      },
    },
    
    deliveryRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryRider', default: null },
    deliveryRiderDetails:{
      name:{
        type:String,
        default:null
      },
      phone:{
        type:String,
        default:null
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
            enum: ['pending', 'accepted', 'returned','not-triable'],
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
          'confirmed_purchase', 
          'returned', 
          'partially_returned',
          'delivered',
          'cancelled',
           'completed', 
          'rejected',
          'completed'
        ],
        default: 'placed'
      },
    customerDeliveryStatus:{
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
    reason:{
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
        enum: ['pending', 'paid', 'failed'],
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
    deliveryDistance:{
      type: Number,
      default: 0
    },
    estimatedTime:{
      type: Number,
      default: 0
    },
    deliveryCharge:{ type: Number, default: 0 },
    deliveryTracking: [
      {
        timestamp: Date,
        status: String,
        location: [Number] // optional: live tracking points
      }
    ],
    returnCharge:{ type: Number, default: 0 },
    otp:{
      type: String,
      default: null
    },
    trialPhaseStart: { type: Date, default: null }, // To store trial phase start time
  trialPhaseEnd: { type: Date, default: null }, // To store trial phase end time
  trialPhaseDuration: { type: Number, default: 0 }, // To store duration in minutes (or your preferred unit)
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },

  }, { timestamps: true });

export default mongoose.model("Order", OrderSchema);
