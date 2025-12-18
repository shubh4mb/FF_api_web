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
  
  tags: [String],

  variants: [variantSchema], // key for fashion variants (sizes, colors, etc.)
  //   accessories: [
  //   {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: 'Product',
  //     required: false
  //   }
  // ],

  isTriable:{type:Boolean,default:true},

  ratings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
