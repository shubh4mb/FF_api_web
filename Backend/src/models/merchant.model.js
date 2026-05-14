import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema(
  {
    shopName: { type: String },
    isOnline: { type: Boolean, default: false },
    shopDescription: { type: String },
    phoneNumber: { type: String },
    ownerName: { type: String },
    managerName: { type: String },
    managerPhoneNumber: { type: String },
    managerEmail: { type: String },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    logo: {
      public_id: String,
      url: String,
    },
    backgroundImage: {
      public_id: String,
      url: String,
    },
    businessType: { 
      type: String, 
      enum: ['Individual', 'Sole Proprietor', 'Partnership', 'Company'] 
    },
    category: [{ type: String }],
    genderCategory: [{ type: String, enum: ['Men', 'Women', 'Kids'] }],
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
    },
    zoneName: { type: String },

    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      landmark: String,
      note: String,
      latitude: { type: Number },      // optional: keep for easy reading
      longitude: { type: Number },     // optional: keep for easy reading
      location: {                      // ← Use this for geospatial queries
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number],    // [longitude, latitude]  <--- VERY IMPORTANT order!
          index: '2dsphere'
        }
      }
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
      pan: {
        number: String,
        image: { url: String, public_id: String },
        verified: { type: Boolean, default: false }
      },
      gst: {
        number: String,
        image: { url: String, public_id: String },
        verified: { type: Boolean, default: false }
      },
      businessProof: {
        proofType: String, // e.g., 'shop_license', 'udyam'
        image: { url: String, public_id: String },
        verified: { type: Boolean, default: false }
      },
      bankProof: {
        image: { url: String, public_id: String },
        verified: { type: Boolean, default: false }
      },
      isKycVerified: { type: Boolean, default: false },
    },
    enableCourierDelivery: { type: Boolean, default: false },
    shipsWithinHours: { type: Number },
    acceptsReturns: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['incomplete', 'pending_verification', 'pending_payment', 'active', 'rejected', 'suspended'],
      default: 'incomplete'
    },
    isRegistrationFeePaid: { type: Boolean, default: false },
    razorpayOrderId: { type: String, default: null },
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
    isZoneLive: { type: Boolean, default: false },
    emailOtp: { type: String },
    emailOtpExpiry: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Merchant", merchantSchema);
