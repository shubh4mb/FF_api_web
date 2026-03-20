
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
    default: 0, // 0 = top-level (e.g. Topwear), 1 = sub (e.g. T-Shirt)
  },

  // ── Gender constraint (who this category is for) ──
  allowedGenders: {
    type: [String],
    enum: ["MEN", "WOMEN", "KIDS"],
    default: ["MEN", "WOMEN"],
  },

  // ── Denormalized ancestry (avoids populate chains) ──
  ancestors: {
    // Level 1 (child): parent info
    parentName: { type: String, default: null },
  },

  // ── Commission (set on leaf categories, level 1) ──
  commissionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
  isTriable: {
    type: Boolean,
    default: false,
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
  logo: {
    public_id: {
      type: String,
      required: false
    },
    url: {
      type: String,
      required: false
    }
  },
  title_banners: [{
    public_id: {
      type: String,
      required: false
    },
    url: {
      type: String,
      required: false
    }
  }],
}, { timestamps: true });


export default mongoose.models.Category || mongoose.model("Category", categorySchema);
