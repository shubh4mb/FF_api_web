
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

  // ── Gender (set on root categories, level 0) ──
  gender: {
    type: String,
    enum: ["Men", "Women", "Unisex", "Kids", "Boys", "Girls"],
    default: null,
  },

  // ── Denormalized ancestry (avoids populate chains) ──
  ancestors: {
    // Level 1 (child): parent info
    parentName: { type: String, default: null },
    parentGender: { type: String, default: null },
    // Level 2 (grandchild): grandparent + parent info
    grandparentName: { type: String, default: null },
    grandparentGender: { type: String, default: null },
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
  title_banner: {
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
