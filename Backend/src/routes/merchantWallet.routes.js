import express from "express";
import { getWalletDetails } from "../helperFns/walletHelper.js";
import { authMiddlewareMerchant } from "../middleware/jwtAuth.js";
import WeeklyPayout from "../models/weeklyPayout.model.js";
import { getCurrentWeekBounds } from "../helperFns/weeklyPayoutHelper.js";

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

/**
 * GET /api/merchant/earnings/current-week
 * Returns current week's pending payout with order breakdown.
 */
router.get("/earnings/current-week", authMiddlewareMerchant, async (req, res) => {
    try {
        const { weekStart, weekEnd } = getCurrentWeekBounds();

        const payout = await WeeklyPayout.findOne({
            ownerType: "merchant",
            ownerId: req.merchantId,
            weekStart,
        }).lean();

        return res.status(200).json({
            success: true,
            weekStart,
            weekEnd,
            payout: payout || {
                totalEarnings: 0,
                totalDeductions: 0,
                netPayout: 0,
                completedOrders: 0,
                finalAmount: 0,
                status: "accumulating",
                orders: [],
            },
        });
    } catch (err) {
        console.error("Get merchant current week error:", err);
        return res.status(500).json({ message: "Failed to fetch current week earnings" });
    }
});

/**
 * GET /api/merchant/earnings/history
 * Returns past weekly payouts (paginated).
 */
router.get("/earnings/history", authMiddlewareMerchant, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const payouts = await WeeklyPayout.find({
            ownerType: "merchant",
            ownerId: req.merchantId,
            status: { $in: ["paid", "failed"] },
        })
            .sort({ weekStart: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        const total = await WeeklyPayout.countDocuments({
            ownerType: "merchant",
            ownerId: req.merchantId,
            status: { $in: ["paid", "failed"] },
        });

        return res.status(200).json({
            success: true,
            payouts,
            pagination: { page: parseInt(page), limit: parseInt(limit), total },
        });
    } catch (err) {
        console.error("Get merchant earnings history error:", err);
        return res.status(500).json({ message: "Failed to fetch earnings history" });
    }
});

export default router;
