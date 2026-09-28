import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    // Platform perspective: 'credit' = inflow (money in), 'debit' = outflow (money out)
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "merchant_payout",
        "rider_payout",
        "user_refund",
        "customer_payment",
        "delivery_fee_recovery",
        "registration_fee",
        "damage_compensation",
        "adjustment",
      ],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["manual_admin", "system_razorpay", "system_cod", "system_qr", "system_auto"],
      default: "manual_admin",
      index: true,
    },
    status: {
      type: String,
      enum: ["completed", "pending", "failed", "cancelled"],
      default: "completed",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    paymentMethod: {
      type: String,
      enum: ["upi", "bank_transfer", "cash", "razorpay", "wallet", "cheque", "other"],
      required: true,
    },
    // UTR number, UPI reference ID, IMPS ref, Bank Txn ID, or Razorpay Payment ID
    referenceNumber: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    // ── Recipient / Party Details ──
    recipientType: {
      type: String,
      enum: ["merchant", "rider", "user", "platform", "other"],
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    // Snapshot of recipient details at transaction time
    recipientDetails: {
      name: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      bankName: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      ifscCode: { type: String, trim: true, default: "" },
      upiId: { type: String, trim: true, default: "" },
      shopName: { type: String, trim: true, default: "" },
    },

    // ── Order / Payout Linkages ──
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    weeklyPayoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WeeklyPayout",
      default: null,
      index: true,
    },

    // ── Proof / Receipt ──
    receipt: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Audit Tracking ──
    performedBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      name: { type: String, default: "Admin" },
      email: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

// Performance compound indexes
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ category: 1, createdAt: -1 });
transactionSchema.index({ recipientType: 1, recipientId: 1 });
transactionSchema.index({ type: 1, status: 1 });

export default mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
