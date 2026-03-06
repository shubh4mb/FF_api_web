/**
 * Rider notification + return photo upload routes.
 */

import express from "express";
import Notification from "../models/notification.model.js";
import Order from "../models/order.model.js";
import { getWalletDetails } from "../helperFns/walletHelper.js";
import { authMiddlewareRider, authMiddleware } from "../middleware/jwtAuth.js"; // authMiddleware added here
import upload from "../middleware/multer.js";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// ── Notifications ──

router.get("/notifications", authMiddlewareRider, async (req, res) => {
    try {
        const riderId = req.riderId;
        const notifications = await Notification.find({ riderId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.status(200).json({ success: true, notifications });
    } catch (err) {
        console.error("Rider get notifications error:", err);
        return res.status(500).json({ message: "Failed to fetch notifications" });
    }
});

router.patch("/notifications/:id", authMiddlewareRider, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, riderId: req.riderId },
            { read: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: "Not found" });
        return res.status(200).json({ success: true, notification });
    } catch (err) {
        return res.status(500).json({ message: "Failed to update notification" });
    }
});

// ── Return Item Photos ──

router.post(
    "/order/return-photos",
    authMiddlewareRider,
    upload.array("photos", 10), // max 10 photos per return
    async (req, res) => {
        try {
            const { orderId } = req.body;
            if (!orderId) return res.status(400).json({ message: "orderId is required" });

            const order = await Order.findById(orderId);
            if (!order) return res.status(404).json({ message: "Order not found" });
            if (order.deliveryRiderId?.toString() !== req.riderId.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: "No photos uploaded" });
            }

            const uploadedPhotos = [];

            for (const file of req.files) {
                // Upload to Cloudinary
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: `flashfits/returns/${orderId}`,
                            resource_type: "image",
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(file.buffer);
                });

                const photo = {
                    url: result.secure_url,
                    public_id: result.public_id,
                    itemId: req.body.itemId || null,
                    uploadedAt: new Date(),
                };

                order.returnPhotos.push(photo);
                uploadedPhotos.push(photo);
            }

            await order.save();

            return res.status(200).json({
                success: true,
                message: `${uploadedPhotos.length} photo(s) uploaded for return evidence.`,
                photos: uploadedPhotos,
            });
        } catch (err) {
            console.error("Return photo upload error:", err);
            return res.status(500).json({ message: "Photo upload failed" });
        }
    }
);

// ── Wallet ──

router.get("/wallet", authMiddlewareRider, async (req, res) => {
    try {
        const details = await getWalletDetails("rider", req.riderId);
        return res.status(200).json({ success: true, ...details });
    } catch (err) {
        console.error("Get rider wallet error:", err);
        return res.status(500).json({ message: "Failed to fetch wallet" });
    }
});

export default router;
