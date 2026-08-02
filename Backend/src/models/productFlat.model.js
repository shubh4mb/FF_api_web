import mongoose from 'mongoose';
import crypto from 'crypto';

const productFlatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  productCode: { type: String, unique: true }, // unique variant product code
  styleGroupId: { 
    type: String, 
    required: true, 
    index: true // Group all sibling variants (e.g. PRD-GROUP-XXXX)
  },
  
  // Shared metadata
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  subSubCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  gender: {
    type: [String],
    enum: ['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'],
    required: true,
    index: true,
  },
  soldBy: { type: String, required: false },
  styleName: { type: String, required: false },
  description: String,
  matchingProducts: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductFlat',
        required: true,
      }
    }
  ],
  features: {
    type: Map,
    of: String,
    default: {}
  },
  attributes: [
    {
      attributeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attribute"
      },
      value: mongoose.Schema.Types.Mixed
    }
  ],
  tags: [String],
  collectionIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
    }
  ],
  isTriable: { type: Boolean, default: true },
  ratings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },

  // Flat Variant Fields (Previously nested inside variants/sizes arrays)
  color: {
    name: { type: String, required: true },
    hex: { type: String }
  },
  size: { type: String, required: true },
  stock: { type: Number, default: 0 },
  mrp: { type: Number, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  images: [{
    public_id: { type: String, required: false },
    url: { type: String, required: false }
  }]
}, { timestamps: true });

// Indexing for quick filtering and searching
productFlatSchema.index({ gender: 1, subCategoryId: 1 });
productFlatSchema.index({ merchantId: 1, gender: 1 });
productFlatSchema.index({ styleGroupId: 1, "color.name": 1, size: 1 }, { unique: true });

productFlatSchema.pre('save', function (next) {
  if (this.isNew && !this.productCode) {
    const randomString = crypto.randomBytes(4).toString('hex').toUpperCase();
    this.productCode = `PRD-${randomString}`;
  }
  next();
});

export default mongoose.model('ProductFlat', productFlatSchema);
