import mongoose from "mongoose";

const hubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    serviceablePincodes: [
      {
        code: {
          type: String,
          required: true,
          trim: true
        },
        areaName: {
          type: String,
          trim: true
        }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Hub", hubSchema);
