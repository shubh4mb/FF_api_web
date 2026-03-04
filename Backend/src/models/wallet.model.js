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
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
        transactions: [transactionSchema],
    },
    { timestamps: true }
);

// Index for fast lookups
walletSchema.index({ userId: 1 });

export default mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
