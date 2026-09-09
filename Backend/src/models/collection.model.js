import mongoose from 'mongoose';

const subCurationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  filterTag: { type: String, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  gender: { type: String, enum: ['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS', 'ALL', ''], default: '' },
  maxPrice: { type: Number },
}, { _id: false });

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
  tagline: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  campaignType: {
    type: String,
    enum: ['curated', 'festival', 'seasonal', 'flash_drop', 'editorial'],
    default: 'curated',
    index: true,
  },
  badgeText: {
    type: String,
    default: '', // e.g. "🌸 ONAM SPECIAL", "⚡ FLASH DROP"
  },
  bannerImage: {
    public_id: { type: String },
    url: { type: String },
  },
  heroBannerImage: {
    public_id: { type: String },
    url: { type: String },
  },
  theme: {
    primaryColor: { type: String, default: '#0EA5E9' },
    secondaryColor: { type: String, default: '#2563EB' },
    bgGradientStart: { type: String, default: '#FFFFFF' },
    bgGradientEnd: { type: String, default: '#F8FAFC' },
    textColor: { type: String, default: '#0F172A' },
    presetName: { type: String, default: 'default' }, // e.g. 'onam_gold', 'diwali_glow', 'summer_brights', 'midnight_luxe'
  },
  schedule: {
    isScheduled: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  smartRules: {
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    subCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    tags: [String],
    keywords: [String],
    colorKeywords: [String],
    genders: [String],
    maxPrice: { type: Number },
  },
  subCurations: [subCurationSchema],
  attachedCouponCode: {
    type: String,
    default: '',
    trim: true,
  },
  pinnedProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductFlat',
  }],
  excludedProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductFlat',
  }],
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

