import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  label: String, // Home, Work, etc.
  street: String,
  city: String,
  state: String,
  pincode: String,
  coordinates: {
    lat: Number,
    lng: Number,
  },
}, { _id: false });

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
  },
  addresses: [addressSchema],

  role: {
    type: String,
    enum: ['user', 'merchant', 'admin'],
    default: 'user',
  },

  isVerified: {
    type: Boolean,
    default: false, // Verified after OTP
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  lastLogin: {
    type: Date,
  },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
