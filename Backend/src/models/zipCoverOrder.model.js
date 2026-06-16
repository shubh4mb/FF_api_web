import mongoose from 'mongoose';

const zipCoverOrderSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    quantities: {
      small: {
        type: Number,
        default: 0,
        min: 0,
        max: 30,
      },
      medium: {
        type: Number,
        default: 0,
        min: 0,
        max: 30,
      },
      large: {
        type: Number,
        default: 0,
        min: 0,
        max: 30,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const ZipCoverOrder = mongoose.model('ZipCoverOrder', zipCoverOrderSchema);

export default ZipCoverOrder;
