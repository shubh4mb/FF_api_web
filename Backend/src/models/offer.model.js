import mongoose from 'mongoose';

/**
 * ── Offer Types ──
 * ADMIN OFFERS:
 *   FIRST_TIME_USER  → "₹150 OFF on first order"
 *   CART_VALUE        → "₹100 OFF above ₹999"
 *   CATEGORY          → "20% OFF on Men's Wear"
 *   FLASH_SALE        → "40% OFF for next 2 hours"
 *
 * MERCHANT OFFERS:
 *   VENDOR_DISCOUNT   → "Flat 25% OFF on Nike Store"
 *   VENDOR_MIN_ORDER  → "Free delivery above ₹799"
 *   VENDOR_CLEARANCE  → "Up to 60% OFF on last stock"
 */

const offerSchema = new mongoose.Schema({
  // ── Display ──
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  badgeText: {
    type: String,
    default: '',       // "FLAT 25% OFF", "FLASH SALE", "NEW USER"
  },
  bannerImage: {
    public_id: { type: String },
    url: { type: String },
  },

  // ── Classification ──
  type: {
    type: String,
    enum: [
      'FIRST_TIME_USER',
      'CART_VALUE',
      'CATEGORY',
      'FLASH_SALE',
      'COLLECTION',
      'VENDOR_DISCOUNT',
      'VENDOR_MIN_ORDER',
      'VENDOR_CLEARANCE',
    ],
    required: true,
    index: true,
  },
  scope: {
    type: String,
    enum: ['admin', 'merchant'],
    required: true,
    index: true,
  },

  // ── Order Type Targeting ──
  applicableTo: {
    type: String,
    enum: ['try_and_buy', 'courier', 'both'],
    default: 'both',
    index: true,
  },

  // ── Stacking Logic ──
  benefitType: {
    type: String,
    enum: ['PRODUCT', 'CART', 'DELIVERY'],
    default: 'CART', // e.g. CART_VALUE, FIRST_TIME_USER
  },
  stackable: {
    type: Boolean,
    default: true,
  },
  isExclusive: {
    type: Boolean,
    default: false,
  },

  // ── Ownership ──
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByModel',
  },
  createdByModel: {
    type: String,
    enum: ['Admin', 'Merchant'],
    default: 'Admin',
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    default: null,    // null for admin offers
    index: true,
  },

  // ── Discount Definition ──
  discountType: {
    type: String,
    enum: ['flat', 'percentage'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  maxDiscount: {
    type: Number,
    default: null,    // Cap for percentage discounts (e.g. max ₹200 off)
  },

  // ── Eligibility Conditions ──
  conditions: {
    minCartValue: { type: Number, default: 0 },           // Cart Value Offers
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],  // Category-Based
    subCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],    // Product-specific
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }, // Collection-specific
    genders: [{ type: String, enum: ['MEN', 'WOMEN', 'KIDS'] }],              // Gender targeting
    firstTimeUserOnly: { type: Boolean, default: false },  // First-Time User
    minOrderValue: { type: Number, default: 0 },           // Vendor Min Order
  },

  // ── Time Constraints ──
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isFlashSale: {
    type: Boolean,
    default: false,
  },

  // ── Coupon ──
  couponCode: {
    type: String,
    default: null,
    uppercase: true,
    trim: true,
    sparse: true,
    index: true,
  },
  requiresCoupon: {
    type: Boolean,
    default: false,   // false = auto-apply, true = needs code
  },

  // ── Usage Limits ──
  maxUsageTotal: {
    type: Number,
    default: null,    // null = unlimited
  },
  maxUsagePerUser: {
    type: Number,
    default: 1,
  },
  currentUsage: {
    type: Number,
    default: 0,
  },

  // ── Special Flags ──
  freeDelivery: {
    type: Boolean,
    default: false,   // VENDOR_MIN_ORDER: free delivery when met
  },

  // ── Priority ──
  priority: {
    type: Number,
    default: 0,       // Higher = evaluated first
  },

  // ── Status ──
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: true });

// ── Compound Indexes ──
offerSchema.index({ scope: 1, isActive: 1, endDate: 1 });
offerSchema.index({ type: 1, isActive: 1 });
offerSchema.index({ merchantId: 1, isActive: 1 });
offerSchema.index({ couponCode: 1 }, { sparse: true });

/**
 * Virtual: Check if offer is currently valid (time-wise)
 */
offerSchema.virtual('isCurrentlyValid').get(function () {
  const now = new Date();
  return this.isActive && this.startDate <= now && this.endDate > now;
});

/**
 * Virtual: Check if usage limit is reached
 */
offerSchema.virtual('isUsageLimitReached').get(function () {
  if (this.maxUsageTotal === null) return false;
  return this.currentUsage >= this.maxUsageTotal;
});

offerSchema.set('toJSON', { virtuals: true });
offerSchema.set('toObject', { virtuals: true });

export default mongoose.models.Offer || mongoose.model('Offer', offerSchema);
