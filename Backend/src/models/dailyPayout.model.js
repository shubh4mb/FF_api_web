import mongoose from "mongoose";

const loginWindowSchema = new mongoose.Schema({
    start: { type: Date, required: true },
    end: { type: Date, default: null },
});

const dailyIncentiveEntrySchema = new mongoose.Schema({
    incentiveId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderIncentive" },
    name: { type: String },
    amount: { type: Number, default: 0 },
});

const dailyPayoutSchema = new mongoose.Schema(
    {
        riderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DeliveryRider",
            required: true,
        },
        date: { type: Date, required: true }, // Calendar day (start of day IST)
        weeklyPayoutId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WeeklyPayout",
            default: null,
        },

        // ── Daily Stats ──
        completedOrders: { type: Number, default: 0 },
        cancelledOrders: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },

        // ── Login Tracking ──
        loginHours: { type: Number, default: 0 }, // Total hours online
        loginWindows: [loginWindowSchema],

        // ── Daily Incentives ──
        incentivesEarned: [dailyIncentiveEntrySchema],
        totalIncentive: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// One record per rider per day
dailyPayoutSchema.index({ riderId: 1, date: 1 }, { unique: true });

export default mongoose.models.DailyPayout ||
    mongoose.model("DailyPayout", dailyPayoutSchema);
