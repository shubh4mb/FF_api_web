import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5,
  },
  verified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// TTL Index — auto-delete expired OTPs after 10 minutes grace period
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });

export default mongoose.models.Otp || mongoose.model('Otp', otpSchema);
