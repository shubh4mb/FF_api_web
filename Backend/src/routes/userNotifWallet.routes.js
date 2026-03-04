/**
 * Notification & Wallet API routes for the User (Customer) app.
 *
 * GET  /api/user/notifications      → list notifications
 * PATCH /api/user/notifications/:id  → mark as read
 * GET  /api/user/wallet             → get wallet balance + transactions
 */

import express from "express";
import Notification from "../models/notification.model.js";
import { getWalletDetails } from "../helperFns/walletHelper.js";
import { authMiddleware } from "../middleware/jwtAuth.js";

const router = express.Router();

// ── Notifications ──

router.get("/notifications", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();
        return res.status(200).json({ success: true, notifications });
    } catch (err) {
        console.error("Get notifications error:", err);
        return res.status(500).json({ message: "Failed to fetch notifications" });
    }
});

router.patch("/notifications/:id", authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { read: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: "Not found" });
        return res.status(200).json({ success: true, notification });
    } catch (err) {
        console.error("Mark read error:", err);
        return res.status(500).json({ message: "Failed to update notification" });
    }
});

router.patch("/notifications/read-all", authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.userId, read: false },
            { read: true }
        );
        return res.status(200).json({ success: true, message: "All marked as read" });
    } catch (err) {
        return res.status(500).json({ message: "Failed to update" });
    }
});

// ── Wallet ──

router.get("/wallet", authMiddleware, async (req, res) => {
    try {
        const details = await getWalletDetails(req.user.userId);
        return res.status(200).json({ success: true, ...details });
    } catch (err) {
        console.error("Get wallet error:", err);
        return res.status(500).json({ message: "Failed to fetch wallet" });
    }
});

export default router;
