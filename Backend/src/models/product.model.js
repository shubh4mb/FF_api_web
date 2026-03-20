import mongoose from 'mongoose';


const variantSchema = new mongoose.Schema({
  color: {
    name: String,
    hex: String,
  },
  sizes: [
    {
      size: {
        type: String,
      },
      stock: {
        type: Number,
        default: 0,
      },
    }
  ],
  mrp: Number, // Original price before discount

  price: Number,

  images: [{
    public_id: {
      type: String,
      required: false
    },
    url: {
      type: String,
      required: false
    }
  }],
  discount: {
    type: Number,
    default: 0,
  }
}, { _id: true }); // IMPORTANT



const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true,
  },

  // Category Structure (2 levels: L0 = e.g. Topwear, L1 = e.g. T-Shirt)
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

  // Gender: who this product is for (array for unisex support)
  gender: {
    type: [String],
    enum: ['MEN', 'WOMEN', 'KIDS'],
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
        ref: 'Product',
        required: true,
      },
      variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Variant',
        required: true,
      },
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

  variants: [variantSchema], // key for fashion variants (sizes, colors, etc.)

  isTriable: { type: Boolean, default: true },

  ratings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes for fast gender + category queries
productSchema.index({ gender: 1, subCategoryId: 1 });
productSchema.index({ merchantId: 1, gender: 1 });

export default mongoose.model('Product', productSchema);
