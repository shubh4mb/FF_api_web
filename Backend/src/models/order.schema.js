import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: mongoose.Schema.Types.ObjectId },
    quantity: Number,
    price: Number, // price at the time of purchase
    status: {
      type: String,
      enum: ['pending', 'kept', 'returned'],
      default: 'pending', // pending until user confirms what they keep
    },
    feedback: String, // optional user feedback (e.g. "too tight")
  });
  
  const subOrderSchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: ['awaiting-try', 'try-done', 'confirmed', 'returned'],
      default: 'awaiting-try',
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'picked-up'],
      default: 'pending',
    },
  });
  
  const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subOrders: [subOrderSchema],
    totalAmount: {
      type: Number,
      default: 0, // updated after try confirmation
    },
    trySession: {
      scheduledAt: Date,
      completedAt: Date,
      status: {
        type: String,
        enum: ['not-started', 'in-progress', 'completed'],
        default: 'not-started',
      },
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    paymentMethod: String,
    deliveryAddress: {
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      phone: String,
    },
    createdAt: { type: Date, default: Date.now },
  });
  
  export default mongoose.models.Order || mongoose.model("Order", orderSchema);