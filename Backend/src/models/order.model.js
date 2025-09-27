import mongoose from "mongoose";
const OrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
    deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy', default: null },
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
          'try_phase', 
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
    deliveryBoyStatus: {
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
        address: String,
        coordinates: { type: [Number], index: '2dsphere' } // [longitude, latitude]
    },
    deliveryCharge:{ type: Number, default: 0 },
    deliveryTracking: [
      {
        timestamp: Date,
        status: String,
        location: [Number] // optional: live tracking points
      }
    ],
  }, { timestamps: true });

export default mongoose.model("Order", OrderSchema);
