import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true, // Refers to a specific variant (color + size)
  },
  image: {
    public_id: String,
    url: String,
  },
  size: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  stockQuantity: {
    type: Number,
    required: true, // Set to false if you want it to be optional
    min: 0,     // Default value if not explicitly set
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant', // For multi-shop cart support
    required: false, // not required for warehouse items
  },
  // ── Source: where this item will be fulfilled from ──
  // 'shop' = merchant's physical store (existing default)
  // 'warehouse' = FlashFits warehouse
  source: {
    type: String,
    enum: ['shop', 'warehouse'],
    default: 'shop',
  },
  // Set when source = 'warehouse'
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null,
  },
  // Set when source = 'warehouse' (the WarehouseProduct _id)
  warehouseProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
  selectedOffers: [{
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    targetItemIds: [{ type: mongoose.Schema.Types.ObjectId }]
  }],
  couponCode: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Cart || mongoose.model('Cart', cartSchema);



