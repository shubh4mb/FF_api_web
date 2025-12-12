// models/Wishlist.js
import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantIndex: {
      // This matches the index of the variant in product.variants array
      type: Number,
      required: true,
      min: 0,
    },
    // Optional: store snapshot of key variant info (highly recommended)
    variantSnapshot: {
      color: {
        name: String,
        hex: String,
      },
      size: String,
      price: Number,
      mrp: Number,
      discount: Number,
      image: String, // first image of that variant
    },
  },
  { timestamps: true }
);

// Unique: one user can wishlist the same product+variant only once
wishlistSchema.index({ userId: 1, productId: 1, variantIndex: 1 }, { unique: true });

// For popularity queries
wishlistSchema.index({ productId: 1, variantIndex: 1 });

export default mongoose.model('Wishlist', wishlistSchema);