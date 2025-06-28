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
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',  // optional, used if type === 'category'
    },
    filter: { type: Object }, // optional custom filters, e.g., { price: { $lt: 1000 } }
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  });
  
  export default mongoose.model('TitleBanner', titleBannerSchema);
  