import mongoose from 'mongoose';

const courierCartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
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
    required: true,
    min: 0,
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
  },
});

const courierCartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [courierCartItemSchema],
  selectedOffers: [{
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    targetItemIds: [{ type: mongoose.Schema.Types.ObjectId }]
  }],
  couponCode: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.CourierCart || mongoose.model('CourierCart', courierCartSchema);
