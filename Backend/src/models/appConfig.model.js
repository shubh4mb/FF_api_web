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
        waitingChargePerMinute: {
            type: Number,
            default: 2, // ₹2 per minute
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

        // ── Warehouse Commission ──
        // Default % FF takes from each warehouse sale (can be overridden per warehouse/product)
        defaultWarehouseCommissionRate: {
            type: Number,
            default: 10, // 10%
            min: 0,
            max: 100,
        },

        // ── Order Placement / Maintenance Mode ──
        isOrderPlacementEnabled: {
            type: Boolean,
            default: false, // Default to false pre-launch so orders can only be placed when admin toggles it ON
        },
        // ── Order Testing Mode (SB Fashion Isolation) ──
        isTestingMode: {
            type: Boolean,
            default: false, // When true, Customer App is restricted exclusively to SB Fashion (warehouse & store)
        },
        maintenanceTitle: {
            type: String,
            default: "Maintenance in Progress",
        },
        maintenanceMessage: {
            type: String,
            default: "We are currently gearing up for launch! Live ordering is temporarily paused. Please check back soon.",
        },

        // ── Session Tracking ──
        heartbeatTimeoutMs: {
            type: Number,
            default: 5 * 60 * 1000, // 5 minutes
            min: 60000,
        },

        // ── Dynamic Promotional Marquee Announcements ──
        promoAnnouncements: {
            type: [
                {
                    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
                    badge: { type: String, default: "OFFER" },
                    title: { type: String, required: true },
                    subtitle: { type: String, default: "" },
                    highlightText: { type: String, default: "" },
                    actionUrl: { type: String, default: "" },
                    icon: { type: String, default: "flash" },
                    isActive: { type: Boolean, default: true },
                    order: { type: Number, default: 0 },
                }
            ],
            default: [
                {
                    id: "promo_free_delivery",
                    badge: "2 FREE DELIVERIES",
                    title: "2 Free Deliveries on your first 2 orders!",
                    subtitle: "Auto-applied at checkout • Zero delivery fee",
                    highlightText: "2 Free Deliveries",
                    actionUrl: "",
                    icon: "flash",
                    isActive: true,
                    order: 0,
                },
                {
                    id: "promo_refer_earn",
                    badge: "REFER & EARN",
                    title: "Refer a friend & get a free delivery coupon!",
                    subtitle: "Tap to share your invite code with friends",
                    highlightText: "+1 Free Delivery",
                    actionUrl: "/(app)/refer-earn",
                    icon: "gift",
                    isActive: true,
                    order: 1,
                },
            ],
        },

        // ── App Versions & Force Update Policies ──
        customerAppVersion: {
            minVersion: {
                type: String,
                default: "1.0.0",
            },
            latestVersion: {
                type: String,
                default: "1.1.0",
            },
            storeUrl: {
                type: String,
                default: "market://details?id=com.flashfits.app",
            },
            webUrl: {
                type: String,
                default: "https://play.google.com/store/apps/details?id=com.flashfits.app",
            },
            minVersionIos: {
                type: String,
                default: "1.0.0",
            },
            latestVersionIos: {
                type: String,
                default: "1.1.0",
            },
            storeUrlIos: {
                type: String,
                default: "itms-apps://itunes.apple.com/app/com.flashfits.app",
            },
            webUrlIos: {
                type: String,
                default: "https://apps.apple.com/app/com.flashfits.app",
            },
            mandatoryTitle: {
                type: String,
                default: "Mandatory Update Required",
            },
            mandatoryMessage: {
                type: String,
                default: "A critical new version of FlashFits is required to continue shopping and tracking orders. Please update now.",
            },
            optionalTitle: {
                type: String,
                default: "New Version Available",
            },
            optionalMessage: {
                type: String,
                default: "Discover fresh features, smoother checkout, and new styles. Update now for the best experience!",
            },
            releaseNotes: {
                type: [String],
                default: [
                    "Performance improvements & smoother experience",
                    "Bug fixes and stability enhancements",
                ],
            },
        },

        deliveryAppVersion: {
            minVersion: {
                type: String,
                default: "1.0.0",
            },
            latestVersion: {
                type: String,
                default: "1.0.0",
            },
            storeUrl: {
                type: String,
                default: "market://details?id=com.flashfits.delivery",
            },
            webUrl: {
                type: String,
                default: "https://play.google.com/store/apps/details?id=com.flashfits.delivery",
            },
            minVersionIos: {
                type: String,
                default: "1.0.0",
            },
            latestVersionIos: {
                type: String,
                default: "1.0.0",
            },
            storeUrlIos: {
                type: String,
                default: "itms-apps://itunes.apple.com/app/com.flashfits.delivery",
            },
            webUrlIos: {
                type: String,
                default: "https://apps.apple.com/app/com.flashfits.delivery",
            },
        },

        merchantAppVersion: {
            minVersion: {
                type: String,
                default: "1.0.0",
            },
            latestVersion: {
                type: String,
                default: "1.0.0",
            },
            storeUrl: {
                type: String,
                default: "market://details?id=com.flashfits.merchant",
            },
            webUrl: {
                type: String,
                default: "https://play.google.com/store/apps/details?id=com.flashfits.merchant",
            },
            minVersionIos: {
                type: String,
                default: "1.0.0",
            },
            latestVersionIos: {
                type: String,
                default: "1.0.0",
            },
            storeUrlIos: {
                type: String,
                default: "itms-apps://itunes.apple.com/app/com.flashfits.merchant",
            },
            webUrlIos: {
                type: String,
                default: "https://apps.apple.com/app/com.flashfits.merchant",
            },
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
