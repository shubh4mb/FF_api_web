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
        deliveryRadius: {
            type: Number,
            default: 5, // max delivery radius in km
            min: 0,
        },
        tryAndBuyRadius: {
            type: Number,
            default: 7, // default 7km for Try & Buy
            min: 0,
        },

        // ── Payout Configuration ──
        payoutDay: {
            type: Number,
            default: 2,    // 0=Sun, 1=Mon, 2=Tue (default), 3=Wed, 4=Thu, 5=Fri, 6=Sat
            min: 0,
            max: 6,
        },
        payoutHourIST: {
            type: Number,
            default: 2,    // 2 AM IST
            min: 0,
            max: 23,
        },

        // ── Merchant Fees ──
        merchantRegistrationFee: {
            type: Number,
            default: 1000,
            min: 0,
        },
    },
    { timestamps: true }
);

appConfigSchema.statics.getConfig = async function () {
    try {
        let config = await this.findOne();
        if (!config) {
            config = await this.create({});
        }
        return config;
    } catch (error) {
        throw error;
    }
};

export default mongoose.models.AppConfig ||
    mongoose.model("AppConfig", appConfigSchema);
