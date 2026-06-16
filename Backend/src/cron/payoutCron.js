/**
 * payoutCron.js
 *
 * Scheduled tasks for weekly payouts and daily incentive processing.
 * Uses node-cron for scheduling.
 */

import cron from "node-cron";
import AppConfig from "../models/appConfig.model.js";
import { processWeeklyPayouts, processDailyIncentives } from "../helperFns/weeklyPayoutHelper.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Initialize payout cron jobs.
 * Call this once from your server startup (e.g., server.js / index.js).
 */
export function initPayoutCron() {
    // ── Hourly check for weekly payout (runs every hour, checks if it's payout day+hour) ──
    cron.schedule("0 * * * *", async () => {
        try {
            const config = await AppConfig.getConfig();
            const payoutDay = config.payoutDay ?? 2;       // Default: Tuesday
            const payoutHour = config.payoutHourIST ?? 2;  // Default: 2 AM IST

            // Get current IST time
            const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
            const currentDay = nowIST.getUTCDay();
            const currentHour = nowIST.getUTCHours();

            if (currentDay === payoutDay && currentHour === payoutHour) {
                console.log(`[Payout Cron] 🚀 Payout day detected (${DAY_NAMES[payoutDay]}, ${payoutHour}:00 IST). Processing...`);
                const result = await processWeeklyPayouts();
                console.log(`[Payout Cron] ✅ Completed:`, result);
            }
        } catch (error) {
            console.error("[Payout Cron] ❌ Error:", error.message);
        }
    });

    // ── Daily incentive evaluation at 00:30 IST (processes yesterday's daily incentives) ──
    // 00:30 IST = 19:00 UTC (previous day)
    cron.schedule("0 19 * * *", async () => {
        try {
            console.log("[Daily Incentive Cron] 🚀 Processing yesterday's daily incentives...");
            await processDailyIncentives();
            console.log("[Daily Incentive Cron] ✅ Completed.");
        } catch (error) {
            console.error("[Daily Incentive Cron] ❌ Error:", error.message);
        }
    });

    console.log("[Cron] ✅ Payout and incentive crons initialized.");
}
