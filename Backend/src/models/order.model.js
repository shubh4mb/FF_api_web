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
      }
    ],
    totalAmount: Number,
    status: {
      type: String,
      enum: ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    deliveryLocation: {
      address: String,
      coordinates: { type: [Number], index: '2dsphere' } // [longitude, latitude]
    },
    deliveryTracking: [
      {
        timestamp: Date,
        status: String,
        location: [Number] // optional: live tracking points
      }
    ],
    createdAt: { type: Date, default: Date.now }
  });
  