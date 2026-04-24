/**
 * payout.controllers.js
 *
 * Admin endpoints for viewing and managing weekly payouts.
 */

import WeeklyPayout from "../../models/weeklyPayout.model.js";
import { processWeeklyPayouts, getCurrentWeekBounds } from "../../helperFns/weeklyPayoutHelper.js";

/**
 * GET /api/admin/payouts
 * View weekly payout summary.
 * Query params: ?week=YYYY-MM-DD&type=rider|merchant&status=accumulating|paid|failed
 */
export const getPayouts = async (req, res) => {
    try {
        const { week, type, status, page = 1, limit = 50 } = req.query;

        const filter = {};

        if (type) filter.ownerType = type;
        if (status) filter.status = status;

        if (week) {
            // Find the week containing this date
            const date = new Date(week);
            const { weekStart, weekEnd } = getCurrentWeekBounds(date);
            filter.weekStart = weekStart;
        }

        const payouts = await WeeklyPayout.find(filter)
            .sort({ weekStart: -1, ownerType: 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        const total = await WeeklyPayout.countDocuments(filter);

        // Summary stats
        const summary = {
            totalRecords: total,
            totalEarnings: payouts.reduce((s, p) => s + (p.totalEarnings || 0), 0),
            totalDeductions: payouts.reduce((s, p) => s + (p.totalDeductions || 0), 0),
            totalIncentives: payouts.reduce((s, p) => s + (p.totalIncentive || 0), 0),
            totalFinalAmount: payouts.reduce((s, p) => s + (p.finalAmount || 0), 0),
        };

        return res.status(200).json({
            success: true,
            payouts,
            summary,
            pagination: { page: parseInt(page), limit: parseInt(limit), total },
        });
    } catch (error) {
        console.error("Get payouts error:", error);
        return res.status(500).json({ message: "Failed to fetch payouts." });
    }
};

/**
 * POST /api/admin/payouts/trigger
 * Manually trigger weekly payout processing. For testing/admin use.
 */
export const triggerPayout = async (req, res) => {
    try {
        console.log("[Admin] Manual payout trigger initiated.");
        const result = await processWeeklyPayouts();

        return res.status(200).json({
            success: true,
            message: "Payout processing completed.",
            ...result,
        });
    } catch (error) {
        console.error("Trigger payout error:", error);
        return res.status(500).json({ message: "Failed to trigger payout." });
    }
};

/**
 * GET /api/admin/payouts/:id
 * Get detailed payout record (with full order breakdown).
 */
export const getPayoutById = async (req, res) => {
    try {
        const payout = await WeeklyPayout.findById(req.params.id).lean();
        if (!payout) {
            return res.status(404).json({ message: "Payout not found." });
        }

        return res.status(200).json({ success: true, payout });
    } catch (error) {
        console.error("Get payout by id error:", error);
        return res.status(500).json({ message: "Failed to fetch payout." });
    }
};
