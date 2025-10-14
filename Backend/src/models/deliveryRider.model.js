import mongoose from "mongoose";

const DeliveryRiderSchema = new mongoose.Schema({
  fullName: {
    type: String,
    // required: true,
    trim: true,
  },
  dob: {
    type: Date,
    // required: true,
  },
  age: {
    type: Number,
    // required: true,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other", "Prefer not to say"],
  },
  email: {
    type: String,
    // required: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  city: {
    type: String,
    // required: true,
  },
  area: {
    type: String,
    // required: true,
  },
  pincode: {
    type: String,
    // required: true,
  },

  // ✅ Both sides of documents
  documents: {
    aadhaarFront: {
      public_id: String,
      url: String,
    },
    aadhaarBack: {
      public_id: String,
      url: String,
    },
    licenseFront: {
      public_id: String,
      url: String,
    },
    licenseBack: {
      public_id: String,
      url: String,
    },
    panFront: {
      public_id: String,
      url: String,
    },
    panBack: {
      public_id: String,
      url: String,
    },
    // vehicleNumber: {
    //   public_id: String,
    //   url: String,
    // },
    // vehicleType: {
    //   type: String,
    //   enum: ["bike", "scooter", "cycle", "car"],
    //   default: "bike",
    // },
  },

  training: {
    videoWatched: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },

  bankDetails: {
    accountHolderName: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
  },

  isAvailable: {
    type: Boolean,
    default: true,
  },
  isBusy: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "suspended", "busy"],
    default: "inactive",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  onboardingFeePaid: {
    type: Boolean,
    default: false,
  },
  location: {
    coordinates: {
      type: [Number],
      index: "2dsphere",
      default: [0, 0],
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  currentOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("DeliveryRider", DeliveryRiderSchema);