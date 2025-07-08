import mongoose from 'mongoose';

const merchantSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
  shopDescription: { type: String },
  ownerName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  logo: {
    public_id: String,
    url: String,
  },
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
    isKycVerified: { type: Boolean, default: false },
  },
  
  isVerified: { type: Boolean, default: false }, // Admin will verify
  isActive: { type: Boolean, default: true },
  operatingHours: {
    open: { type: String },  // e.g., "10:00 AM"
    close: { type: String }, // e.g., "8:00 PM"
    daysOpen: [String],      // e.g., ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  stats: {
    totalProducts: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalReturns: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
  isOnline :{type:Boolean,default:false},
}, { timestamps: true });

export default mongoose.model('Merchant', merchantSchema);
