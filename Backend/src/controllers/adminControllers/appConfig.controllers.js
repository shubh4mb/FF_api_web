import AppConfig from "../../models/appConfig.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { generateReceiptPDF } from "../../utils/pdfGenerator.js";
import { isBackendInTestMode } from "../../helperFns/testModeHelper.js";

/**
 * GET /api/admin/config
 * Returns the current app configuration (creates defaults if none exist).
 */
export const getAppConfig = async (req, res) => {
    try {
        const config = await AppConfig.getConfig();
        return res.status(200).json(new ApiResponse(200, { config }, "Config fetched successfully"));
    } catch (error) {
        console.error("Get AppConfig Error:", error);
        return res.status(500).json({ message: "Failed to fetch config" });
    }
};

/**
 * PUT /api/admin/config
 * Update delivery/return per-km rates and waiting charge.
 * Body: { deliveryPerKmRate?, returnPerKmRate?, waitingCharge? }
 */
export const updateAppConfig = async (req, res) => {
    try {
        const {
            deliveryPerKmRate,
            returnPerKmRate,
            waitingCharge,
            deliveryRadius,
            tryAndBuyRadius,
            merchantRegistrationFee,
            isOrderPlacementEnabled,
            isTestingMode,
            maintenanceTitle,
            maintenanceMessage,
        } = req.body;

        const config = await AppConfig.getConfig();

        if (deliveryPerKmRate !== undefined) config.deliveryPerKmRate = deliveryPerKmRate;
        if (returnPerKmRate !== undefined) config.returnPerKmRate = returnPerKmRate;
        if (waitingCharge !== undefined) config.waitingCharge = waitingCharge;
        if (deliveryRadius !== undefined) config.deliveryRadius = deliveryRadius;
        if (tryAndBuyRadius !== undefined) config.tryAndBuyRadius = tryAndBuyRadius;
        if (merchantRegistrationFee !== undefined) config.merchantRegistrationFee = merchantRegistrationFee;

        if (isOrderPlacementEnabled !== undefined) config.isOrderPlacementEnabled = !!isOrderPlacementEnabled;
        if (isTestingMode !== undefined) config.isTestingMode = !!isTestingMode;
        if (maintenanceTitle !== undefined) config.maintenanceTitle = maintenanceTitle;
        if (maintenanceMessage !== undefined) config.maintenanceMessage = maintenanceMessage;

        if (req.body.customerAppVersion) {
            config.customerAppVersion = {
                ...(config.customerAppVersion?.toObject?.() || config.customerAppVersion || {}),
                ...req.body.customerAppVersion
            };
        }
        if (req.body.deliveryAppVersion) {
            config.deliveryAppVersion = {
                ...(config.deliveryAppVersion?.toObject?.() || config.deliveryAppVersion || {}),
                ...req.body.deliveryAppVersion
            };
        }
        if (req.body.merchantAppVersion) {
            config.merchantAppVersion = {
                ...(config.merchantAppVersion?.toObject?.() || config.merchantAppVersion || {}),
                ...req.body.merchantAppVersion
            };
        }

        if (req.body.promoAnnouncements !== undefined) {
            config.promoAnnouncements = req.body.promoAnnouncements;
        }

        await config.save();

        return res.status(200).json(new ApiResponse(200, { config }, "Config updated successfully"));
    } catch (error) {
        console.error("Update AppConfig Error:", error);
        return res.status(500).json({ message: "Failed to update config" });
    }
};

/**
 * GET /api/user/app-version?app=customer
 * Public endpoint to fetch app version update policy for a given app.
 */
export const getAppVersionPolicy = async (req, res) => {
    try {
        const { app = "customer", platform = "" } = req.query;
        const config = await AppConfig.getConfig();

        let versionPolicy;
        if (app === "delivery") {
            versionPolicy = config.deliveryAppVersion?.toObject?.() || config.deliveryAppVersion || {};
        } else if (app === "merchant") {
            versionPolicy = config.merchantAppVersion?.toObject?.() || config.merchantAppVersion || {};
        } else {
            versionPolicy = config.customerAppVersion?.toObject?.() || config.customerAppVersion || {};
        }

        const isIos = String(platform || "").toLowerCase() === "ios";

        // Fallback URLs for iOS if not yet set in database
        const defaultIosStoreUrl = app === "delivery"
            ? "itms-apps://itunes.apple.com/app/com.flashfits.delivery"
            : (app === "merchant"
                ? "itms-apps://itunes.apple.com/app/com.flashfits.merchant"
                : "itms-apps://itunes.apple.com/app/com.flashfits.app");

        const defaultIosWebUrl = app === "delivery"
            ? "https://apps.apple.com/app/com.flashfits.delivery"
            : (app === "merchant"
                ? "https://apps.apple.com/app/com.flashfits.merchant"
                : "https://apps.apple.com/app/com.flashfits.app");

        // Resolve platform-specific versions with backwards-compatible defaults
        const defaultAndroidMinVersion = app === "customer" ? "1.1.2" : "1.0.0";
        const defaultAndroidLatestVersion = app === "customer" ? "1.1.2" : "1.0.0";

        const minVersion = isIos
            ? (versionPolicy.minVersionIos || versionPolicy.minVersion || "1.0.0")
            : (versionPolicy.minVersionAndroid || versionPolicy.minVersion || defaultAndroidMinVersion);

        const latestVersion = isIos
            ? (versionPolicy.latestVersionIos || versionPolicy.latestVersion || "1.1.0")
            : (versionPolicy.latestVersionAndroid || versionPolicy.latestVersion || defaultAndroidLatestVersion);

        const minVersionAndroid = versionPolicy.minVersionAndroid || versionPolicy.minVersion || defaultAndroidMinVersion;
        const latestVersionAndroid = versionPolicy.latestVersionAndroid || versionPolicy.latestVersion || defaultAndroidLatestVersion;

        const storeUrl = isIos
            ? (versionPolicy.storeUrlIos || (versionPolicy.storeUrl?.startsWith("market://") ? defaultIosStoreUrl : versionPolicy.storeUrl) || defaultIosStoreUrl)
            : (versionPolicy.storeUrl || "market://details?id=com.flashfits.app");

        const webUrl = isIos
            ? (versionPolicy.webUrlIos || (versionPolicy.webUrl?.includes("play.google.com") ? defaultIosWebUrl : versionPolicy.webUrl) || defaultIosWebUrl)
            : (versionPolicy.webUrl || "https://play.google.com/store/apps/details?id=com.flashfits.app");

        // Attach system operational status for fast client boot lookup
        const inTestMode = await isBackendInTestMode();
        const payload = {
            ...versionPolicy,
            minVersion,
            latestVersion,
            minVersionAndroid,
            latestVersionAndroid,
            storeUrl,
            webUrl,
            isOrderPlacementEnabled: inTestMode ? true : (config.isOrderPlacementEnabled ?? false),
            maintenanceTitle: config.maintenanceTitle || "Maintenance in Progress",
            maintenanceMessage: config.maintenanceMessage || "We are currently gearing up for launch! Live ordering is temporarily paused. Please check back soon.",
        };

        // Dual-format payload for 100% backward compatibility:
        // Works both when client reads res.data directly or res.data.data
        return res.status(200).json({
            statusCode: 200,
            success: true,
            message: "App version policy fetched successfully",
            data: payload,
            ...payload,
        });
    } catch (error) {
        console.error("Get AppVersionPolicy Error:", error);
        return res.status(500).json({ message: "Failed to fetch app version policy" });
    }
};

/**
 * GET /api/user/system-status
 * Public lightweight endpoint to fetch system operational status / maintenance mode.
 */
export const getSystemStatus = async (req, res) => {
    try {
        const config = await AppConfig.getConfig();
        const inTestMode = await isBackendInTestMode();
        return res.status(200).json({
            success: true,
            isOrderPlacementEnabled: inTestMode ? true : (config.isOrderPlacementEnabled ?? false),
            maintenanceTitle: inTestMode ? "" : (config.maintenanceTitle || "Maintenance in Progress"),
            maintenanceMessage: inTestMode ? "" : (config.maintenanceMessage || "We are currently gearing up for launch! Live ordering is temporarily paused. Please check back soon."),
        });
    } catch (error) {
        console.error("Get SystemStatus Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch system status" });
    }
};

export const generateDummyReceipt = async (req, res) => {
    try {
        const config = await AppConfig.getConfig();
        const pdfBuffer = await generateReceiptPDF({
            shopName: "Dummy Merchant Shop",
            merchantEmail: "dummy@flashfits.com",
            amount: config.merchantRegistrationFee || 999,
            paymentId: "pay_dummy12345678",
            date: new Date()
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="dummy_receipt.pdf"');
        return res.send(pdfBuffer);
    } catch (error) {
        console.error("Generate Dummy Receipt Error:", error);
        return res.status(500).json({ message: "Failed to generate receipt" });
    }
};

/**
 * GET /api/user/promotions
 * Public lightweight endpoint to fetch active promotional marquee / carousel announcements.
 */
export const getPromotions = async (req, res) => {
    try {
        const config = await AppConfig.getConfig();
        let promos = config.promoAnnouncements || [];
        if (!promos || promos.length === 0) {
            promos = [
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
            ];
        }
        const activePromos = promos.filter(p => p.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
        return res.status(200).json({
            statusCode: 200,
            success: true,
            promotions: activePromos,
            data: activePromos,
        });
    } catch (error) {
        console.error("Get Promotions Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch promotions" });
    }
};
