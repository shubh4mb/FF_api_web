import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  label: String,
  houseOrFlat: String,
  street: String,
  city: String,
  state: String,
  pincode: String,
  coordinates: {
    type: [Number], // [longitude, latitude]
    index: "2dsphere",
    required: true
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  profilePicture: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
  },
  password: {
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

  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  expoPushTokens: { type: [String], default: [] },

  // Referral System
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // Penalty tracking: incremented when customer doesn't pay delivery fee after try phase
  deliveryFeePenalties: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// Pre-save hook to generate a unique referral code for new users
userSchema.pre('save', async function (next) {
  if (!this.referralCode) {
    let isUnique = false;
    let newCode = '';
    while (!isUnique) {
      // Generate a 6-character alphanumeric code
      newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      // Check if it already exists
      const existing = await mongoose.models.User.findOne({ referralCode: newCode });
      if (!existing) {
        isUnique = true;
      }
    }
    this.referralCode = newCode;
  }
  next();
});

export default mongoose.models.User || mongoose.model('User', userSchema);
