//src/models/deliveryRider.model.js
import mongoose from "mongoose";


const DeliveryRiderSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    // required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
      default: [0, 0]
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },
  documents: {
    aadharNumber: String,
    licenseNumber: String,
    profilePhoto: String,
    licensePhoto: String,
    vehicleNumber: String,
    vehicleType: {
      type: String,
      enum: ['bike', 'scooter', 'cycle', 'car'],
      default: 'bike'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended','busy'],
    default: 'active'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("DeliveryRider", DeliveryRiderSchema);
