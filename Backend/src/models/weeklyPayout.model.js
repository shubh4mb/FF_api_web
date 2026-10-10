import mongoose from "mongoose";

const orderEntrySchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, refPath: "orderModel" },
    orderModel: { type: String, enum: ["Order", "CourierOrder", "WarehouseOrder"], default: "Order" },
    amount: { type: Number, required: true }, // Net payout credited
    type: { type: String, enum: ["credit", "debit"], required: true },
    grossAmount: { type: Number, default: 0 }, // Retail item value
    commissionRate: { type: Number, default: 4 }, // Category commission %
    commissionAmount: { type: Number, default: 0 }, // Flashfits 4% cut
    merchantDiscount: { type: Number, default: 0 }, // Merchant coupon discount
    description: { type: String, default: "" },
    settledAt: { type: Date, default: Date.now },
});

const incentiveEntrySchema = new mongoose.Schema({
    incentiveId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderIncentive" },
    name: { type: String },
    amount: { type: Number, default: 0 },
    slabMatched: {
        minOrders: Number,
        bonus: Number,
    },
});

const weeklyPayoutSchema = new mongoose.Schema(
    {
        ownerType: {
            type: String,
            enum: ["merchant", "rider"],
            required: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: "ownerType === 'merchant' ? 'Merchant' : 'DeliveryRider'",
        },
        weekStart: { type: Date, required: true },
        weekEnd: { type: Date, required: true },
        status: {
            type: String,
            enum: ["accumulating", "finalized", "paid", "failed"],
            default: "accumulating",
        },

        // ── Financial Totals ──
        totalGrossSales: { type: Number, default: 0 }, // Retail gross sales across all items
        totalCommission: { type: Number, default: 0 }, // Platform 4% commission deducted
        totalEarnings: { type: Number, default: 0 },   // Net earnings (Gross - Commission)
        totalDeductions: { type: Number, default: 0 }, // Penalties, damage compensations
        netPayout: { type: Number, default: 0 },       // Final bank payout amount

        // ── Admin Adjustments ──
        adminDeduction: {
            amount: { type: Number, default: 0 },
            reason: { type: String, default: "" },
        },

        // ── Rider-specific Stats ──
        completedOrders: { type: Number, default: 0 },
        cancelledOrders: { type: Number, default: 0 },

        // ── Incentives (calculated at payout time) ──
        incentivesEarned: [incentiveEntrySchema],
        totalIncentive: { type: Number, default: 0 },

        // ── Final Amount ──
        finalAmount: { type: Number, default: 0 },

        // ── Audit Trail ──
        orders: [orderEntrySchema],

        // ── Proof of Payment / Bank Settlement ──
        receipt: {
            url: { type: String, default: null },
            public_id: { type: String, default: null },
        },
        referenceNumber: { type: String, default: null, trim: true },
        paymentMethod: {
            type: String,
            enum: ["upi", "bank_transfer", "cash", "razorpay", "wallet", "cheque", "other"],
            default: "bank_transfer",
        },
        transactionId: { type: String, default: null },
        notes: { type: String, default: "", trim: true },

        paidAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Compound unique index: one payout per owner per week
weeklyPayoutSchema.index(
    { ownerType: 1, ownerId: 1, weekStart: 1 },
    { unique: true }
);
// Query by status for cron
weeklyPayoutSchema.index({ status: 1, weekEnd: 1 });

export default mongoose.models.WeeklyPayout ||
    mongoose.model("WeeklyPayout", weeklyPayoutSchema);
