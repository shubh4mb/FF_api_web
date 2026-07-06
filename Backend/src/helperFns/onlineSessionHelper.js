/**
 * onlineSessionHelper.js
 *
 * Core logic for rider online session tracking.
 * Sessions are backed by MongoDB (OnlineSession model) and use server-side
 * timestamps exclusively. The mobile app never calculates duration.
 */

import OnlineSession from "../models/onlineSession.model.js";
import DeliveryRider from "../models/deliveryRider.model.js";
import DailyPayout from "../models/dailyPayout.model.js";
import AppConfig from "../models/appConfig.model.js";
import { getDayStartIST } from "./weeklyPayoutHelper.js";

/**
 * Start a new online session for a rider.
 * Idempotent — if an active session already exists, it is returned as-is.
 *
 * @param {string} riderId
 * @returns {Object} { session, created: boolean }
 */
export async function startSession(riderId) {
  // Check for an existing active session
  const existing = await OnlineSession.findOne({
    riderId,
    status: "active",
  });

  if (existing) {
    // Update heartbeat on reconnect
    existing.lastHeartbeatAt = new Date();
    await existing.save();
    return { session: existing, created: false };
  }

  const now = new Date();
  const session = await OnlineSession.create({
    riderId,
    status: "active",
    startedAt: now,
    lastHeartbeatAt: now,
  });

  return { session, created: true };
}

/**
 * End the active session for a rider.
 * Calculates totalDurationMs using server timestamps and syncs to DailyPayout.
 *
 * @param {string} riderId
 * @param {"manual"|"heartbeat_timeout"} reason
 * @returns {Object|null} The ended session, or null if no active session
 */
export async function endSession(riderId, reason = "manual") {
  const session = await OnlineSession.findOne({
    riderId,
    status: "active",
  });

  if (!session) return null;

  const now = new Date();
  session.endedAt = now;
  session.status = "ended";
  session.endReason = reason;
  session.totalDurationMs = now.getTime() - session.startedAt.getTime();
  await session.save();

  // Sync to DailyPayout loginWindows + loginHours
  await syncSessionToDailyPayout(session);

  return session;
}

/**
 * Update the heartbeat timestamp on the active session.
 * Called from location updates (both REST and socket).
 *
 * @param {string} riderId
 */
export async function heartbeatSession(riderId) {
  await OnlineSession.findOneAndUpdate(
    { riderId, status: "active" },
    { lastHeartbeatAt: new Date() }
  );
}

/**
 * Associate a completed order with the active session.
 *
 * @param {string} riderId
 * @param {string} orderId
 */
export async function addOrderToSession(riderId, orderId) {
  await OnlineSession.findOneAndUpdate(
    { riderId, status: "active" },
    { $addToSet: { completedOrderIds: orderId } }
  );
}

/**
 * Sweep stale sessions — called by cron every 2 minutes.
 *
 * For each active session whose lastHeartbeatAt exceeds the configured timeout:
 *   - If the rider has NO active order → end the session (heartbeat_timeout)
 *   - If the rider HAS an active order → skip (session stays alive)
 */
export async function sweepStaleSessions() {
  const config = await AppConfig.getConfig();
  const timeoutMs = config.heartbeatTimeoutMs || 5 * 60 * 1000;
  const cutoff = new Date(Date.now() - timeoutMs);

  const staleSessions = await OnlineSession.find({
    status: "active",
    lastHeartbeatAt: { $lt: cutoff },
  });

  if (staleSessions.length === 0) return;

  let ended = 0;
  let skipped = 0;

  for (const session of staleSessions) {
    // Check if rider has an active order
    const rider = await DeliveryRider.findById(session.riderId)
      .select("currentOrderId")
      .lean();

    if (rider?.currentOrderId) {
      // Rider has an active order — don't end the session
      skipped++;
      continue;
    }

    // End the stale session
    const now = new Date();
    session.endedAt = now;
    session.status = "ended";
    session.endReason = "heartbeat_timeout";
    session.totalDurationMs = now.getTime() - session.startedAt.getTime();
    await session.save();

    await syncSessionToDailyPayout(session);
    ended++;

    console.log(
      `[Session Sweep] Ended stale session for rider ${session.riderId} (inactive ${Math.round((now.getTime() - session.lastHeartbeatAt.getTime()) / 1000)}s)`
    );
  }

  if (ended > 0 || skipped > 0) {
    console.log(
      `[Session Sweep] Processed ${staleSessions.length} stale sessions: ${ended} ended, ${skipped} skipped (active order)`
    );
  }
}

/**
 * Sync an ended session's duration into the DailyPayout loginWindows + loginHours.
 * This keeps the existing incentive engine working without changes.
 *
 * @param {Object} session - The ended OnlineSession document
 */
async function syncSessionToDailyPayout(session) {
  try {
    const dayStart = getDayStartIST();
    const durationHours = (session.totalDurationMs || 0) / (1000 * 60 * 60);

    await DailyPayout.findOneAndUpdate(
      { riderId: session.riderId, date: dayStart },
      {
        $push: {
          loginWindows: {
            start: session.startedAt,
            end: session.endedAt,
          },
        },
        $inc: {
          loginHours: Math.round(durationHours * 100) / 100, // 2 decimal places
        },
        $setOnInsert: {
          riderId: session.riderId,
          date: dayStart,
          completedOrders: 0,
          cancelledOrders: 0,
          totalEarnings: 0,
          incentivesEarned: [],
          totalIncentive: 0,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(
      `[Session] Failed to sync session to DailyPayout for rider ${session.riderId}:`,
      err.message
    );
  }
}
