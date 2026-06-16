import mongoose from 'mongoose';

/**
 * Tracks per-user offer redemption for enforcing usage limits
 * and analytics.
 */
const offerUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    required: true,
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'orderModel',
    required: true,
  },
  orderModel: {
    type: String,
    enum: ['Order', 'CourierOrder'],
    default: 'Order',
  },
  discountApplied: {
    type: Number,
    required: true,
    min: 0,
  },
  usedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Compound index: fast per-user-per-offer lookup
offerUsageSchema.index({ userId: 1, offerId: 1 });

export default mongoose.models.OfferUsage || mongoose.model('OfferUsage', offerUsageSchema);
