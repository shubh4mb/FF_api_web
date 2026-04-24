import express from 'express';
import { processWeeklyPayouts, processDailyIncentives } from '../helperFns/weeklyPayoutHelper.js';

const router = express.Router();

/**
 * Middleware to verify cron secret key.
 * This ensures only authorized external services (like cron-job.org) can trigger these routes.
 */
const verifyCronSecret = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;

    // We check both Authorization header (Bearer token) or ?token query parameter
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (queryToken) {
        token = queryToken;
    }

    const expectedSecret = process.env.CRON_SECRET_KEY;

    if (!expectedSecret) {
        console.warn('⚠️ CRON_SECRET_KEY is not defined in environment variables. Cron endpoints are disabled.');
        return res.status(503).json({ message: 'Cron endpoints are not configured.' });
    }

    if (token !== expectedSecret) {
        return res.status(401).json({ message: 'Unauthorized cron request.' });
    }

    next();
};

/**
 * POST /api/cron/process-weekly-payouts
 * Endpoint for cron-job.org to trigger weekly payouts.
 * Recommended schedule on cron-job.org: Every Tuesday at 02:00 AM IST (or whatever time is preferred).
 */
router.post('/process-weekly-payouts', verifyCronSecret, async (req, res) => {
    try {
        console.log('[External Cron] Triggered process-weekly-payouts');
        const result = await processWeeklyPayouts();
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error('[External Cron] Error processing weekly payouts:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * POST /api/cron/process-daily-incentives
 * Endpoint for cron-job.org to trigger daily incentives.
 * Recommended schedule on cron-job.org: Every day at 00:30 AM IST.
 */
router.post('/process-daily-incentives', verifyCronSecret, async (req, res) => {
    try {
        console.log('[External Cron] Triggered process-daily-incentives');
        await processDailyIncentives();
        return res.status(200).json({ success: true, message: 'Daily incentives processed.' });
    } catch (error) {
        console.error('[External Cron] Error processing daily incentives:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;
