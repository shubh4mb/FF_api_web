import mongoose from "mongoose";
const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
    deliveryRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryRider', default: null },
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
          'confirmed_purchase', 
          'returned', 
          'partially_returned',
          'delivered',
          'cancelled',
          'rejected'
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
          'unassigned',               // Initial state
          'assigned',                 // Delivery boy assigned
          'en route to pickup',       // On the way to merchant
          'arrived at pickup',        // Reached merchant location
          'picked & verified order',          // Order picked
          'en route to delivery',     // Going to customer
          'arrived at delivery',      // Reached customer location
          // 'waiting for customer',     // Waiting while user tries (Try & Buy)
          'try phase',    // Try phase ongoing
          'completed try phase',      // Delivery boy marks try phase completed
          'confirmed return',         // Items returned
          'confirmed purchase',       // Customer accepted items
          'delivered',                // Final confirmation
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
      label: String,
      houseOrFlat: String,
      street: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere",
        // required: true
      }
    },
    deliveryDistance:{
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
    otp:{
      type: String,
      default: null
    },
    trialPhaseStart: { type: Date, default: null }, // To store trial phase start time
  trialPhaseEnd: { type: Date, default: null }, // To store trial phase end time
  trialPhaseDuration: { type: Number, default: 0 }, // To store duration in minutes (or your preferred unit)

  }, { timestamps: true });

export default mongoose.model("Order", OrderSchema);
