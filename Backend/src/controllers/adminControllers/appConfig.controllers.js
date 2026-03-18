import AppConfig from "../../models/appConfig.model.js";

/**
 * GET /api/admin/config
 * Returns the current app configuration (creates defaults if none exist).
 */
export const getAppConfig = async (req, res) => {
    try {
        const config = await AppConfig.getConfig();
        return res.status(200).json({ success: true, config });
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
        const { deliveryPerKmRate, returnPerKmRate, waitingCharge, deliveryRadius } = req.body;

        const config = await AppConfig.getConfig();

        if (deliveryPerKmRate !== undefined) config.deliveryPerKmRate = deliveryPerKmRate;
        if (returnPerKmRate !== undefined) config.returnPerKmRate = returnPerKmRate;
        if (waitingCharge !== undefined) config.waitingCharge = waitingCharge;
        if (deliveryRadius !== undefined) config.deliveryRadius = deliveryRadius;

        await config.save();

        return res.status(200).json({
            success: true,
            message: "Config updated successfully",
            config,
        });
    } catch (error) {
        console.error("Update AppConfig Error:", error);
        return res.status(500).json({ message: "Failed to update config" });
    }
};
