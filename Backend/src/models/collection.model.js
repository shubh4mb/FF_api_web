import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    lowercase: true,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    default: '',
  },
  bannerImage: {
    public_id: { type: String },
    url: { type: String },
  },
  priority: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: true });

// Auto-generate slug before saving
collectionSchema.pre('save', function (next) {
  if (this.name && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  }
  next();
});

export default mongoose.models.Collection || mongoose.model('Collection', collectionSchema);
