import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    courierOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourierOrder",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      default: null,
    },
    deliveryRiderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryRider",
      default: null,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    action: {
      type: String,
      required: true, // e.g. "ORDER_CREATED", "ORDER_STATUS_CHANGED", "PAYMENT_INITIATED", "PAYMENT_SUCCESS", "PAYMENT_FAILED", "REFUND_PROCESSED"
    },
    status: {
      type: String,
      enum: ["success", "failure", "pending", "info"],
      default: "success",
    },
    message: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed, // Storing json payloads (e.g. razorpay order IDs, status details, error messages, webhooks)
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Performance indexes for admin searches
auditLogSchema.index({ orderId: 1, createdAt: -1 });
auditLogSchema.index({ courierOrderId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ merchantId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
