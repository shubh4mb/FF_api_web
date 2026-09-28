import mongoose from "mongoose";

const returnIssueSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deliveryRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryRider",
      default: null,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    itemDetails: {
      name: { type: String },
      size: { type: String },
      price: { type: Number },
      image: { type: String },
    },
    issueType: {
      type: String,
      enum: ["damage", "missing", "other"],
      required: true,
    },
    damageCategory: {
      type: String,
      enum: [
        "fabric_tear",
        "stain_dirty",
        "tag_missing",
        "broken_zipper_button",
        "wrong_item_returned",
        "item_missing",
        "odour_used",
        "other",
      ],
      default: "other",
    },
    description: {
      type: String,
      required: true,
    },
    images: [
      {
        url: { type: String },
        public_id: { type: String },
      },
    ],
    status: {
      type: String,
      enum: [
        "pending",
        "investigating",
        "resolved_merchant_compensated",
        "resolved_customer_fault",
        "resolved_rider_fault",
        "resolved",
        "rejected",
      ],
      default: "pending",
    },
    resolutionNotes: {
      type: String,
      default: "",
    },
    adminActionTaken: {
      type: String,
      enum: [
        "none",
        "user_blocked",
        "rider_suspended",
        "merchant_warned",
        "merchant_suspended",
        "payout_adjusted",
      ],
      default: "none",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    reportedBy: {
      type: String,
      enum: ["merchant", "user", "rider"],
      default: "merchant",
    },
    // ── Compensation / Refund Tracking ──
    isMerchantRefunded: {
      type: Boolean,
      default: false,
    },
    compensationAmount: {
      type: Number,
      default: 0,
    },
    compensationTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    compensationMethod: {
      type: String,
      default: null,
    },
    compensationReferenceNumber: {
      type: String,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

returnIssueSchema.index({ merchantId: 1, createdAt: -1 });
returnIssueSchema.index({ userId: 1, createdAt: -1 });
returnIssueSchema.index({ deliveryRiderId: 1, createdAt: -1 });
returnIssueSchema.index({ status: 1 });
returnIssueSchema.index({ orderId: 1 });

export default mongoose.model("ReturnIssue", returnIssueSchema);
