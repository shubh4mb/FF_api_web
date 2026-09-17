import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    index: true,
    sparse: true,
  },
  email: {
    type: String,
    index: true,
    sparse: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ['phone_login', 'email_register', 'password_reset'],
    default: 'email_register',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
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
