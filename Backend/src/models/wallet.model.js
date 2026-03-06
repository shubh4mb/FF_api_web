import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["credit", "debit"],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        default: "",
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const walletSchema = new mongoose.Schema(
    {
        // ── Owner fields (exactly one should be set) ──
        ownerType: {
            type: String,
            enum: ["user", "merchant", "rider", "admin"],
            required: true,
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

        balance: {
            type: Number,
            default: 0,
        },
        transactions: [transactionSchema],
    },
    { timestamps: true }
);

// ── Sparse unique indexes (only one owner per wallet) ──
walletSchema.index({ userId: 1 }, { unique: true, sparse: true });
walletSchema.index({ merchantId: 1 }, { unique: true, sparse: true });
walletSchema.index({ deliveryRiderId: 1 }, { unique: true, sparse: true });
walletSchema.index({ adminId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
