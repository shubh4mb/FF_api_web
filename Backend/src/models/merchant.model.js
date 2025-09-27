import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema(
  {
    shopName: { type: String },
    isOnline:{ type: Boolean, default: false },
    shopDescription: { type: String },
    ownerName: { type: String },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    logo: {
      public_id: String,
      url: String,
    },
    category: { type: String },  
    address: {
      street: String,
      city: String,
      postalCode: String,
    },
    documents: {
      gstNumber: String,
      gstCertificateUrl: String,
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
      upiId: String,
      isBankVerified: { type: Boolean, default: false },
    },
    kyc: {
      gstNumber: String,
      gstCertificateUrl: String,
      panNumber: String,
      panCardUrl: String,
      businessLicenseUrl: String,
      isKycVerified: { type: Boolean, default: false },
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    operatingHours: {
      open: { type: String },
      close: { type: String },
      daysOpen: [String],
    },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    stats: {
      totalProducts: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      totalReturns: { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    emailOtp: { type: String },
    emailOtpExpiry: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Merchant", merchantSchema);
