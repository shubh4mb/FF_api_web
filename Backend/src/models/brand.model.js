import mongoose from "mongoose";

const brandSchema = new mongoose.Schema({
    name: String,
    logo: {
      public_id: String,
      url: String,
    },
    createdByType: {
      type: String,
      enum: ['Admin', 'Merchant'],
      required: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
    //   required: true,
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  }, { timestamps: true });
  

export default mongoose.models.Brand || mongoose.model("Brand", brandSchema);