import mongoose from 'mongoose';

const merchantSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
  ownerName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },

  documents: {
    gstNumber: String,
    gstCertificateUrl: String,
    shopLogoUrl: String,
  },
  earnings: {
    pendingBalance: { type: Number, default: 0 },
    paidBalance: { type: Number, default: 0 },
    lastPayoutDate: Date,
  },
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String, // optional
    isBankVerified: { type: Boolean, default: false },
  },
  kyc: {
    gstNumber: String,
    gstCertificateUrl: String,
    panNumber: String,
    panCardUrl: String,
    businessLicenseUrl: String,
    isKycVerified: { type: Boolean, default: false }, // Admin manually verifies
  },
  isVerified: { type: Boolean, default: false }, // Admin will verify
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Merchant', merchantSchema);
