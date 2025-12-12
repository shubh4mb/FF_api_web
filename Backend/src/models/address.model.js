import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true
    },

    addressLine1: {
      type: String,
      required: true
    },

    addressLine2: {
      type: String
    },

    landmark: {
      type: String
    },
    
    city: {
      type: String,
      required: true
    },

    state: {
      type: String,
      required: true
    },

    pincode: {
      type: String,
      required: true
    },

    country: {
      type: String,
      default: "India"
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],  // [longitude, latitude]
        required: true
      }
    },

    addressType: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home"
    },

    isDefault: {
      type: Boolean,
      default: false
    },

    deliveryInstructions: {
      type: String
    }
  },
  { timestamps: true }
);

// For fast geo queries
addressSchema.index({ location: "2dsphere" });

export default mongoose.model("Address", addressSchema);
