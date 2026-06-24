/**
 * weeklyPayoutHelper.js
 *
 * Manages the weekly payout lifecycle: creation, accumulation, and processing.
 */

import WeeklyPayout from "../models/weeklyPayout.model.js";
import DailyPayout from "../models/dailyPayout.model.js";
import { creditWallet, debitWallet } from "./walletHelper.js";
import { evaluateWeeklyIncentives, evaluateDailyIncentives } from "./incentiveEngine.js";

// ── IST Offset: +5:30 ──
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Get the current date/time in IST.
 */
function nowIST() {
    return new Date(Date.now() + IST_OFFSET_MS);
}

/**
 * Get the Monday–Sunday week bounds for a given date (in IST).
 * @param {Date} [date] - defaults to now
 * @returns {{ weekStart: Date, weekEnd: Date }}
 */
export function getCurrentWeekBounds(date = null) {
    const ist = date ? new Date(date.getTime() + IST_OFFSET_MS) : nowIST();

    // Get day of week (0=Sun, 1=Mon, ..., 6=Sat)
    const dayOfWeek = ist.getUTCDay();
    // Shift so Monday=0, Sunday=6
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Monday 00:00:00 IST
    const weekStart = new Date(ist);
    weekStart.setUTCDate(ist.getUTCDate() - offset);
    weekStart.setUTCHours(0, 0, 0, 0);
    // Convert back to UTC
    const weekStartUTC = new Date(weekStart.getTime() - IST_OFFSET_MS);

    // Sunday 23:59:59.999 IST
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);
    const weekEndUTC = new Date(weekEnd.getTime() - IST_OFFSET_MS);

    return { weekStart: weekStartUTC, weekEnd: weekEndUTC };
}

/**
 * Get the start-of-day (IST) for a given date, returned in UTC.
 */
export function getDayStartIST(date = null) {
    const ist = date ? new Date(date.getTime() + IST_OFFSET_MS) : nowIST();
    ist.setUTCHours(0, 0, 0, 0);
    return new Date(ist.getTime() - IST_OFFSET_MS);
}

/**
 * Find or create the WeeklyPayout document for the current cycle.
 * Uses atomic upsert to prevent duplicates.
 */
export async function getOrCreateWeeklyPayout(ownerType, ownerId, session = null) {
    const { weekStart, weekEnd } = getCurrentWeekBounds();

    const payout = await WeeklyPayout.findOneAndUpdate(
        { ownerType, ownerId, weekStart },
        {
            $setOnInsert: {
                ownerType,
                ownerId,
                weekStart,
                weekEnd,
                status: "accumulating",
                totalEarnings: 0,
                totalDeductions: 0,
                netPayout: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                incentivesEarned: [],
                totalIncentive: 0,
                finalAmount: 0,
                orders: [],
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session,
        }
    );

    return payout;
}

/**
 * Add an order settlement entry to the weekly payout.
 * Uses atomic $inc and $push.
 */
export async function addToWeeklyPayout({
    ownerType,
    ownerId,
    orderId,
    amount,
    type, // "credit" | "debit"
    description = "",
    session = null,
}) {
    const { weekStart, weekEnd } = getCurrentWeekBounds();

    const incFields = {};
    if (type === "credit") {
        incFields.totalEarnings = amount;
        incFields.netPayout = amount;
    } else {
        incFields.totalDeductions = amount;
        incFields.netPayout = -amount;
    }

    const payout = await WeeklyPayout.findOneAndUpdate(
        { ownerType, ownerId, weekStart },
        {
            $inc: incFields,
            $push: {
                orders: {
                    orderId,
                    amount,
                    type,
                    description,
                    settledAt: new Date(),
                },
            },
            $setOnInsert: {
                ownerType,
                ownerId,
                weekStart,
                weekEnd,
                status: "accumulating",
                completedOrders: 0,
                cancelledOrders: 0,
                incentivesEarned: [],
                totalIncentive: 0,
                finalAmount: 0,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session,
        }
    );

    return payout;
}

/**
 * Increment the order count for a rider's weekly payout.
 * @param {string} riderId
 * @param {boolean} cancelled - was this a rider-cancelled order?
 * @param {Object} [session]
 */
export async function incrementOrderCount(riderId, cancelled = false, amount = 0, session = null) {
    // If the 3rd parameter is a mongoose session object, shift it
    if (amount && typeof amount === 'object' && (amount.constructor?.name === 'ClientSession' || amount.session)) {
        session = amount;
        amount = 0;
    }

    const { weekStart, weekEnd } = getCurrentWeekBounds();

    const incFields = cancelled
        ? { cancelledOrders: 1 }
        : { completedOrders: 1 };

    await WeeklyPayout.findOneAndUpdate(
        { ownerType: "rider", ownerId: riderId, weekStart },
        {
            $inc: incFields,
            $setOnInsert: {
                ownerType: "rider",
                ownerId: riderId,
                weekStart,
                weekEnd,
                status: "accumulating",
                totalEarnings: 0,
                totalDeductions: 0,
                netPayout: 0,
                incentivesEarned: [],
                totalIncentive: 0,
                finalAmount: 0,
                orders: [],
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session,
        }
    );

    // Also update daily payout
    const dayStart = getDayStartIST();
    const weeklyPayout = await getOrCreateWeeklyPayout("rider", riderId, session);

    const dailyIncFields = cancelled
        ? { cancelledOrders: 1 }
        : { completedOrders: 1, totalEarnings: amount };

    await DailyPayout.findOneAndUpdate(
        { riderId, date: dayStart },
        {
            $inc: dailyIncFields,
            $setOnInsert: {
                riderId,
                date: dayStart,
                weeklyPayoutId: weeklyPayout._id,
                loginHours: 0,
                loginWindows: [],
                incentivesEarned: [],
                totalIncentive: 0,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session,
        }
    );
}

/**
 * Process all finalized weekly payouts.
 * Called by the cron job on payout day.
 */
export async function processWeeklyPayouts() {
    const now = new Date();

    // Find all weekly payouts that are still accumulating and whose week has ended
    const pendingPayouts = await WeeklyPayout.find({
        status: "accumulating",
        weekEnd: { $lt: now },
    });

    console.log(`[Payout Cron] Found ${pendingPayouts.length} pending payouts to process.`);

    let successCount = 0;
    let failCount = 0;

    for (const payout of pendingPayouts) {
        try {
            // Calculate incentives for riders
            if (payout.ownerType === "rider") {
                const incentives = await evaluateWeeklyIncentives(payout.ownerId, payout);
                if (incentives.length > 0) {
                    payout.incentivesEarned = incentives;
                    payout.totalIncentive = incentives.reduce((sum, i) => sum + i.amount, 0);
                }
            }

            payout.finalAmount = payout.netPayout + payout.totalIncentive;

            // Credit or debit the wallet
            if (payout.finalAmount > 0) {
                await creditWallet({
                    ownerType: payout.ownerType === "rider" ? "rider" : "merchant",
                    ownerId: payout.ownerId,
                    amount: payout.finalAmount,
                    description: `Weekly payout (${payout.weekStart.toISOString().split("T")[0]} → ${payout.weekEnd.toISOString().split("T")[0]})`,
                });
            } else if (payout.finalAmount < 0) {
                await debitWallet({
                    ownerType: payout.ownerType === "rider" ? "rider" : "merchant",
                    ownerId: payout.ownerId,
                    amount: Math.abs(payout.finalAmount),
                    description: `Weekly deduction (${payout.weekStart.toISOString().split("T")[0]} → ${payout.weekEnd.toISOString().split("T")[0]})`,
                    allowNegative: true,
                });
            }

            payout.status = "paid";
            payout.paidAt = new Date();
            await payout.save();
            successCount++;
        } catch (error) {
            console.error(`[Payout Cron] Failed to process payout ${payout._id}:`, error.message);
            payout.status = "failed";
            await payout.save().catch(() => {});
            failCount++;
        }
    }

    console.log(`[Payout Cron] Completed. Success: ${successCount}, Failed: ${failCount}`);
    return { successCount, failCount, total: pendingPayouts.length };
}

/**
 * Process daily incentives for yesterday.
 * Called by the cron job at midnight IST.
 */
export async function processDailyIncentives() {
    // Get yesterday's date
    const yesterday = new Date(Date.now() + IST_OFFSET_MS);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const yesterdayUTC = new Date(yesterday.getTime() - IST_OFFSET_MS);

    const dailyPayouts = await DailyPayout.find({ date: yesterdayUTC });

    console.log(`[Daily Incentive] Processing ${dailyPayouts.length} daily records for ${yesterdayUTC.toISOString()}.`);

    for (const dp of dailyPayouts) {
        try {
            const incentives = await evaluateDailyIncentives(dp.riderId, dp);
            if (incentives.length > 0) {
                dp.incentivesEarned = incentives;
                dp.totalIncentive = incentives.reduce((sum, i) => sum + i.amount, 0);
                await dp.save();

                // Add daily incentive bonus to the parent weekly payout
                if (dp.weeklyPayoutId) {
                    await WeeklyPayout.findByIdAndUpdate(dp.weeklyPayoutId, {
                        $inc: { totalIncentive: dp.totalIncentive },
                        $push: {
                            incentivesEarned: {
                                $each: incentives,
                            },
                        },
                    });
                }
            }
        } catch (err) {
            console.error(`[Daily Incentive] Error for rider ${dp.riderId}:`, err.message);
        }
    }
}
