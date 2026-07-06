import AppConfig from "../../models/appConfig.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { generateReceiptPDF } from "../../utils/pdfGenerator.js";

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
        const { deliveryPerKmRate, returnPerKmRate, waitingCharge, deliveryRadius, tryAndBuyRadius, merchantRegistrationFee } = req.body;

        const config = await AppConfig.getConfig();

        if (deliveryPerKmRate !== undefined) config.deliveryPerKmRate = deliveryPerKmRate;
        if (returnPerKmRate !== undefined) config.returnPerKmRate = returnPerKmRate;
        if (waitingCharge !== undefined) config.waitingCharge = waitingCharge;
        if (deliveryRadius !== undefined) config.deliveryRadius = deliveryRadius;
        if (tryAndBuyRadius !== undefined) config.tryAndBuyRadius = tryAndBuyRadius;
        if (merchantRegistrationFee !== undefined) config.merchantRegistrationFee = merchantRegistrationFee;

        await config.save();

        return res.status(200).json(new ApiResponse(200, { config }, "Config updated successfully"));
    } catch (error) {
        console.error("Update AppConfig Error:", error);
        return res.status(500).json({ message: "Failed to update config" });
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
