import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        // Polymorphic: either userId OR riderId is set, never both
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        riderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DeliveryRider",
            default: null,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null,
        },
        type: {
            type: String,
            enum: [
                // Customer notifications (selective — max 3-4 per order)
                "order_placed",
                "order_accepted",
                "rider_arriving",       // covers both "rider assigned" + "arriving soon"
                "delivery_complete",
                "payment_confirmed",
                "order_rejected",
                "refund_credited",

                // Rider notifications (verbose — show all steps)
                "new_order_request",
                "order_timeout",        // missed the 2-min window
                "pickup_ready",         // merchant packed
                "otp_verified",
                "trial_ended",
                "return_started",
                "return_complete",
                "earnings_credited",

                // Generic
                "info",
            ],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            default: "",
        },
        read: {
            type: Boolean,
            default: false,
        },
        // Extra data for deep linking in the app
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Indexes for fast queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ riderId: 1, createdAt: -1 });
notificationSchema.index({ orderId: 1 });

export default mongoose.models.Notification ||
    mongoose.model("Notification", notificationSchema);
