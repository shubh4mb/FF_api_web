/**
 * incentiveEngine.js
 *
 * Evaluates rider performance against active incentive programs.
 * Supports daily and weekly incentives with conditions.
 */

import RiderIncentive from "../models/riderIncentive.model.js";

/**
 * Find the highest qualifying slab for a given order count.
 * Slabs are expected to be sorted ascending by minOrders.
 * Returns null if no slab qualifies.
 */
export function findHighestSlab(slabs, orderCount) {
    let bestSlab = null;
    for (const slab of slabs) {
        if (orderCount >= slab.minOrders) {
            bestSlab = slab;
        }
    }
    return bestSlab;
}

/**
 * Check if a rider's stats meet the incentive's conditions.
 * @param {Object} incentive - The incentive document
 * @param {Object} stats - { completedOrders, cancelledOrders, loginHours }
 * @returns {boolean}
 */
export function checkConditions(incentive, stats) {
    const { conditions } = incentive;
    if (!conditions) return true;

    // 1. Max cancellations check
    if (
        conditions.maxCancellations !== null &&
        conditions.maxCancellations !== undefined &&
        stats.cancelledOrders > conditions.maxCancellations
    ) {
        return false;
    }

    // 2. Min login hours check
    if (
        conditions.minLoginHours !== null &&
        conditions.minLoginHours !== undefined &&
        (stats.loginHours || 0) < conditions.minLoginHours
    ) {
        return false;
    }

    // 3. Time window check (only for daily incentives)
    // This is validated at the order-counting level, not here.
    // The caller should only pass orders that fall within the time window.

    return true;
}

/**
 * Get the number of completed orders within a specific time window for a given day.
 * This looks at the order settlement timestamps in the daily payout.
 * For simplicity, we use the completedOrders count directly when no time window is set.
 * When a time window IS set, we'd need order-level timestamps (future enhancement).
 *
 * For now: if a time window is set, we use the full completedOrders count.
 * A production enhancement would filter by order timestamps.
 */
function getOrderCountForWindow(stats, timeWindow) {
    // If no time window restriction, use full count
    if (!timeWindow || !timeWindow.startTime || !timeWindow.endTime) {
        return stats.completedOrders || 0;
    }

    // For now, return full count (time window filtering is a future enhancement
    // that would require storing per-order timestamps in DailyPayout)
    return stats.completedOrders || 0;
}

/**
 * Evaluate all active WEEKLY incentives for a rider.
 * @param {string} riderId
 * @param {Object} weeklyPayout - The WeeklyPayout document
 * @returns {Array} Array of earned incentive entries
 */
export async function evaluateWeeklyIncentives(riderId, weeklyPayout) {
    const now = new Date();

    const incentives = await RiderIncentive.find({
        type: "weekly",
        isActive: true,
        effectiveFrom: { $lte: now },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $gt: now } },
        ],
    }).lean();

    const earned = [];

    for (const incentive of incentives) {
        const stats = {
            completedOrders: weeklyPayout.completedOrders || 0,
            cancelledOrders: weeklyPayout.cancelledOrders || 0,
            loginHours: 0, // Will be summed from daily payouts
        };

        // Sum login hours from daily payouts for weekly condition check
        if (incentive.conditions?.minLoginHours) {
            const DailyPayout = (await import("../models/dailyPayout.model.js")).default;
            const dailyPayouts = await DailyPayout.find({
                riderId,
                weeklyPayoutId: weeklyPayout._id,
            }).lean();
            stats.loginHours = dailyPayouts.reduce((sum, dp) => sum + (dp.loginHours || 0), 0);
        }

        // Check all conditions
        if (!checkConditions(incentive, stats)) {
            continue;
        }

        // Find highest qualifying slab
        const orderCount = getOrderCountForWindow(stats, incentive.conditions?.activeTimeWindow);
        const slab = findHighestSlab(incentive.slabs, orderCount);

        if (slab) {
            earned.push({
                incentiveId: incentive._id,
                name: incentive.name,
                amount: slab.bonus,
                slabMatched: {
                    minOrders: slab.minOrders,
                    bonus: slab.bonus,
                },
            });
        }
    }

    return earned;
}

/**
 * Evaluate all active DAILY incentives for a rider.
 * @param {string} riderId
 * @param {Object} dailyPayout - The DailyPayout document
 * @returns {Array} Array of earned incentive entries
 */
export async function evaluateDailyIncentives(riderId, dailyPayout) {
    const now = new Date();

    const incentives = await RiderIncentive.find({
        type: "daily",
        isActive: true,
        effectiveFrom: { $lte: now },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $gt: now } },
        ],
    }).lean();

    const earned = [];

    for (const incentive of incentives) {
        const stats = {
            completedOrders: dailyPayout.completedOrders || 0,
            cancelledOrders: dailyPayout.cancelledOrders || 0,
            loginHours: dailyPayout.loginHours || 0,
        };

        // Check conditions
        if (!checkConditions(incentive, stats)) {
            continue;
        }

        // Find highest qualifying slab
        const orderCount = getOrderCountForWindow(stats, incentive.conditions?.activeTimeWindow);
        const slab = findHighestSlab(incentive.slabs, orderCount);

        if (slab) {
            earned.push({
                incentiveId: incentive._id,
                name: incentive.name,
                amount: slab.bonus,
            });
        }
    }

    return earned;
}
