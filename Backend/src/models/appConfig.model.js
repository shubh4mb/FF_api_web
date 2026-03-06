import mongoose from "mongoose";

const appConfigSchema = new mongoose.Schema(
    {
        // ── Rider Per-KM Rates ──
        deliveryPerKmRate: {
            type: Number,
            default: 12, // ₹ per km from shop → customer
            min: 0,
        },
        returnPerKmRate: {
            type: Number,
            default: 7, // ₹ per km for return trip (customer → shop)
            min: 0,
        },
        waitingCharge: {
            type: Number,
            default: 10, // fixed waiting charge ₹
            min: 0,
        },
    },
    { timestamps: true }
);

/**
 * Singleton accessor — always returns exactly ONE config doc.
 */
appConfigSchema.statics.getConfig = async function () {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({});
    }
    return config;
};

export default mongoose.models.AppConfig ||
    mongoose.model("AppConfig", appConfigSchema);
