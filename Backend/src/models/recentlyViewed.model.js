import mongoose from 'mongoose';

const recentlyViewedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);

// We want to upsert or update the timestamp if they view the same product/variant again.
// To make it easier to manage the limit of 20, we can use userId and productId as a unique key for upserting, 
// or userId and variantId if they want to track per variant. 
// Given the frontend sends the primary variant, tracking per productId is usually enough, 
// but let's stick to userId and productId for unique check to keep it simple and clean.
recentlyViewedSchema.index({ userId: 1, productId: 1 }, { unique: true });

export default mongoose.model('RecentlyViewed', recentlyViewedSchema);
