import mongoose from "mongoose";

const slabSchema = new mongoose.Schema({
    minOrders: { type: Number, required: true },
    bonus: { type: Number, required: true },
});

const riderIncentiveSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        type: {
            type: String,
            enum: ["daily", "weekly"],
            required: true,
        },
        isActive: { type: Boolean, default: true },

        // ── Slabs (highest qualifying wins) ──
        slabs: {
            type: [slabSchema],
            validate: {
                validator: function (v) {
                    return v && v.length > 0;
                },
                message: "At least one slab is required",
            },
        },

        // ── Conditions (ALL must be met) ──
        conditions: {
            maxCancellations: { type: Number, default: null }, // null = no limit
            minLoginHours: { type: Number, default: null },    // null = no requirement
            activeTimeWindow: {
                startTime: { type: String, default: null },    // "11:00" (24h IST)
                endTime: { type: String, default: null },      // "15:00"
            },
        },

        effectiveFrom: { type: Date, default: Date.now },
        effectiveTo: { type: Date, default: null }, // null = indefinite
    },
    { timestamps: true }
);

// Auto-sort slabs ascending by minOrders before save
riderIncentiveSchema.pre("save", function (next) {
    if (this.slabs && this.slabs.length > 1) {
        this.slabs.sort((a, b) => a.minOrders - b.minOrders);
    }
    next();
});

export default mongoose.models.RiderIncentive ||
    mongoose.model("RiderIncentive", riderIncentiveSchema);
