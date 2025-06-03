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
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
      },
      stock: {
        type: Number,
        default: 0,
      },    
    }
  ],
  
  images:[ {
    public_id: {
      type: String,
      required: false
    },
      url: {
        type: String,
        required: false
      }
    }], 
    mainImage: {
      public_id: {
        type: String,
        required: false
      },
      url: {
        type: String,
        required: false
      }
    },
  discount: {
    type: Number,
    default: 0,
  },
});



const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true,
  },

  // 🌟 Category Structure (referencing your Category model)
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
  gender: { type: String, enum: ['men', 'women', 'unisex','boys','girls','babies'], default: 'unisex' }, 
  description: String,
  mrp: Number, // Original price before discount
  price: Number,
  tags: [String],

  variants: [variantSchema], // key for fashion variants (sizes, colors, etc.)

  ratings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
