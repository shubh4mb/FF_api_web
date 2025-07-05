import mongoose from "mongoose";

const titleBannerSchema = new mongoose.Schema({
    title: { type: String, required: true },  // e.g. "New Arrivals", "Denim Deals"
    image: {
      url: { type: String, required: true },
      public_id: { type: String }, // if using Cloudinary
    },
    type: {
      type: String,
      enum: ['category', 'custom'], // extend as needed
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',  // optional, used if type === 'category'
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  });
  
  export default mongoose.model('TitleBanner', titleBannerSchema);
  