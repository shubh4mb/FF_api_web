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

/**
 * Singleton accessor — always returns exactly ONE config doc.
 * Optimized with a 5-minute in-memory cache.
 */
let cachedConfig = null;
let lastConfigFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

appConfigSchema.statics.getConfig = async function () {
    const now = Date.now();
    
    // Check if cache is still fresh
    if (cachedConfig && (now - lastConfigFetch < CACHE_TTL_MS)) {
        return cachedConfig;
    }

    try {
        let config = await this.findOne();
        if (!config) {
            config = await this.create({});
        }
        
        // Update cache
        cachedConfig = config;
        lastConfigFetch = now;
        
        return config;
    } catch (error) {
        // If fetch fails, return stale cache as fallback if available
        if (cachedConfig) {
            console.error("[AppConfig] Failed to refresh config, using stale fallback:", error);
            return cachedConfig;
        }
        throw error;
    }
};

// Clear/update the in-memory cache when settings are saved or updated
appConfigSchema.post('save', function (doc) {
    cachedConfig = doc;
    lastConfigFetch = Date.now();
});

appConfigSchema.post(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
    cachedConfig = null;
    lastConfigFetch = 0;
});

export default mongoose.models.AppConfig ||
    mongoose.model("AppConfig", appConfigSchema);
