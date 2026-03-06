import express from "express";
import { getWalletDetails } from "../helperFns/walletHelper.js";
import { authMiddlewareMerchant } from "../middleware/jwtAuth.js";

const router = express.Router();

/**
 * GET /api/merchant/wallet
 * Returns merchant wallet balance and recent transactions.
 */
router.get("/wallet", authMiddlewareMerchant, async (req, res) => {
    try {
        const details = await getWalletDetails("merchant", req.merchantId);
        return res.status(200).json({ success: true, ...details });
    } catch (err) {
        console.error("Get merchant wallet error:", err);
        return res.status(500).json({ message: "Failed to fetch wallet" });
    }
});

export default router;
