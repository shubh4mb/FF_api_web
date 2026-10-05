import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        "order_delayed",
        "return_issue",
        "try_buy_issue",
        "refund_issue",
        "wrong_product",
        "damaged_product",
        "misplaced_product",
        "size_exchange",
        "merchant_issue",
        "report_bug",
        "other",
      ],
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    itemDetails: {
      name: { type: String },
      size: { type: String },
      image: { type: String },
      price: { type: Number },
    },
    message: {
      type: String,
      default: "",
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    resolutionNotes: {
      type: String,
      default: "",
    },
    adminAction: {
      type: String,
      enum: [
        "none",
        "refund_issued",
        "replacement_offered",
        "explained_policy",
        "rider_cautioned",
        "merchant_contacted",
        "rejected",
        "other",
      ],
      default: "none",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1 });

export default mongoose.model("SupportTicket", supportTicketSchema);
