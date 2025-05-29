
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  level: {
    type: Number,
    default: 0, // 0 = top-level, 1 = sub, 2 = sub-sub
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  image: {
    public_id: {
      type: String,
      required: false
    },
      url: {
        type: String,
        required: false
      }
    },
}, { timestamps: true });

export default mongoose.models.Category || mongoose.model("Category", categorySchema);
