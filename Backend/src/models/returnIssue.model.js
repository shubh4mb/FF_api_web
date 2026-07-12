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
    deliveryRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryRider",
      default: null,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    issueType: {
      type: String,
      enum: ["damage", "missing", "other"],
      required: true,
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
      enum: ["pending", "investigating", "resolved", "rejected"],
      default: "pending",
    },
    resolutionNotes: {
      type: String,
      default: "",
    },
    reportedBy: {
      type: String,
      enum: ["merchant", "user", "rider"],
      default: "merchant",
    },
  },
  { timestamps: true }
);

returnIssueSchema.index({ merchantId: 1, createdAt: -1 });
returnIssueSchema.index({ status: 1 });
returnIssueSchema.index({ orderId: 1 });

export default mongoose.model("ReturnIssue", returnIssueSchema);
