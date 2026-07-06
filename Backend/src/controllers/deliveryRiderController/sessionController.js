/**
 * sessionController.js
 *
 * REST handlers for rider online session management.
 * Thin controller layer — delegates to onlineSessionHelper.
 */

import {
  startSession,
  endSession,
} from "../../helperFns/onlineSessionHelper.js";
import OnlineSession from "../../models/onlineSession.model.js";

/**
 * POST /api/deliveryRider/session/start
 * Start a new online session (idempotent — returns existing if active).
 */
export const startOnlineSession = async (req, res) => {
  try {
    const { session, created } = await startSession(req.riderId);

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? "Online session started"
        : "Existing active session resumed",
      session,
    });
  } catch (error) {
    console.error("Error in startOnlineSession:", error);
    return res.status(500).json({ message: "Failed to start online session" });
  }
};

/**
 * POST /api/deliveryRider/session/end
 * End the active online session.
 */
export const endOnlineSession = async (req, res) => {
  try {
    const session = await endSession(req.riderId, "manual");

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "No active session found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Online session ended",
      session,
    });
  } catch (error) {
    console.error("Error in endOnlineSession:", error);
    return res.status(500).json({ message: "Failed to end online session" });
  }
};

/**
 * GET /api/deliveryRider/session/history
 * Get paginated session history + current active session (if any).
 */
export const getSessionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get active session (if any)
    const activeSession = await OnlineSession.findOne({
      riderId: req.riderId,
      status: "active",
    }).lean();

    // Get past sessions
    const sessions = await OnlineSession.find({
      riderId: req.riderId,
      status: "ended",
    })
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await OnlineSession.countDocuments({
      riderId: req.riderId,
      status: "ended",
    });

    return res.status(200).json({
      success: true,
      activeSession: activeSession || null,
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error in getSessionHistory:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch session history" });
  }
};
