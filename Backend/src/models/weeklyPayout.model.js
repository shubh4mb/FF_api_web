import mongoose from "mongoose";

const orderEntrySchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
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
        totalEarnings: { type: Number, default: 0 },
        totalDeductions: { type: Number, default: 0 },
        netPayout: { type: Number, default: 0 },

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
