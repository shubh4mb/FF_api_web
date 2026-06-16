import express from 'express';
import { register, verifyOTP, savePersonalDetails, uploadDocuments, saveBankDetails, getRider, addPushToken, refreshRiderToken } from '../controllers/deliveryRiderController/auth.controllers.js';
import { authMiddlewareRider } from '../middleware/jwtAuth.js';
import upload from '../middleware/multer.js';
import { handleMulterError } from '../middleware/multer.js';
import Notification from "../models/notification.model.js";
import Order from "../models/order.model.js";
import { getWalletDetails } from "../helperFns/walletHelper.js";
import { v2 as cloudinary } from "cloudinary";
import {
  acceptOrder,
  reachedPickupLocation,
  verifyOtp,
  reachedCustomerLocation,
  handOutProducts,
  endTrialPhase,
  verifyOtpOnReturn,
  reachedReturnMerchant,
  verifyMerchantReturnOtp
} from '../controllers/deliveryRiderController/orderController.js';
const router = express.Router();

router.post('/register', register);
router.get('/getRiderById', authMiddlewareRider, getRider);
router.post("/auth/verify-otp", verifyOTP);
router.post("/auth/refresh", refreshRiderToken);
router.put("/push-token", authMiddlewareRider, addPushToken);
router.post("/registration/personal-details", authMiddlewareRider, savePersonalDetails);
router.post(
  "/registration/upload-documents",
  authMiddlewareRider,
  upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "licenseFront", maxCount: 1 },
    { name: "licenseBack", maxCount: 1 },
    { name: "panFront", maxCount: 1 },
    { name: "panBack", maxCount: 1 },
  ]),
  handleMulterError,
  uploadDocuments
);
router.post("/registration/bank-details", authMiddlewareRider, saveBankDetails);

// === Order Flow ===
router.post("/order/acceptOrder", authMiddlewareRider, acceptOrder);
router.post("/order/reachedPickupLocation", authMiddlewareRider, reachedPickupLocation);
router.post("/order/verifyOtp", authMiddlewareRider, verifyOtp);                          // pickup OTP
router.post("/order/reachedCustomerLocation", authMiddlewareRider, reachedCustomerLocation);
router.post("/order/handOutProducts", authMiddlewareRider, handOutProducts);               // starts trial
router.post("/order/endTrialPhase", authMiddlewareRider, endTrialPhase);                   // rider ends wait
router.post("/order/verifyOtpOnReturn", authMiddlewareRider, verifyOtpOnReturn);          // return OTP verify
router.post("/order/reachedReturnMerchant", authMiddlewareRider, reachedReturnMerchant);   // ✅ was missing!
router.post("/order/verifyMerchantReturnOtp", authMiddlewareRider, verifyMerchantReturnOtp);

// ── Reviews ──
import { createRiderReview, deleteReview } from '../controllers/userControllers/review.controllers.js';
router.post('/review', authMiddlewareRider, createRiderReview);
router.delete('/review/:reviewId', authMiddlewareRider, deleteReview);

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

// ── Weekly Earnings ──
import WeeklyPayout from "../models/weeklyPayout.model.js";
import DailyPayout from "../models/dailyPayout.model.js";
import RiderIncentive from "../models/riderIncentive.model.js";
import { getCurrentWeekBounds, getDayStartIST } from "../helperFns/weeklyPayoutHelper.js";
import { findHighestSlab } from "../helperFns/incentiveEngine.js";

// GET /api/rider/earnings/current-week
router.get("/earnings/current-week", authMiddlewareRider, async (req, res) => {
  try {
    const { weekStart, weekEnd } = getCurrentWeekBounds();

    const payout = await WeeklyPayout.findOne({
      ownerType: "rider",
      ownerId: req.riderId,
      weekStart,
    }).lean();

    // Get daily breakdowns for this week
    const dailyPayouts = await DailyPayout.find({
      riderId: req.riderId,
      date: { $gte: weekStart, $lte: weekEnd },
    })
      .sort({ date: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      weekStart,
      weekEnd,
      payout: payout || {
        totalEarnings: 0,
        totalDeductions: 0,
        netPayout: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalIncentive: 0,
        finalAmount: 0,
        status: "accumulating",
        orders: [],
      },
      dailyBreakdown: dailyPayouts,
    });
  } catch (err) {
    console.error("Get current week earnings error:", err);
    return res.status(500).json({ message: "Failed to fetch earnings" });
  }
});

// GET /api/rider/earnings/history
router.get("/earnings/history", authMiddlewareRider, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const payouts = await WeeklyPayout.find({
      ownerType: "rider",
      ownerId: req.riderId,
      status: { $in: ["paid", "failed"] },
    })
      .sort({ weekStart: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await WeeklyPayout.countDocuments({
      ownerType: "rider",
      ownerId: req.riderId,
      status: { $in: ["paid", "failed"] },
    });

    return res.status(200).json({
      success: true,
      payouts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    console.error("Get earnings history error:", err);
    return res.status(500).json({ message: "Failed to fetch earnings history" });
  }
});

// GET /api/rider/incentives — Active incentive programs + rider's progress
router.get("/incentives", authMiddlewareRider, async (req, res) => {
  try {
    const now = new Date();
    const incentives = await RiderIncentive.find({
      isActive: true,
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }],
    }).lean();

    const { weekStart } = getCurrentWeekBounds();
    const dayStart = getDayStartIST();

    // Get rider's current stats
    const weeklyPayout = await WeeklyPayout.findOne({
      ownerType: "rider",
      ownerId: req.riderId,
      weekStart,
    }).lean();

    const dailyPayout = await DailyPayout.findOne({
      riderId: req.riderId,
      date: dayStart,
    }).lean();

    const result = incentives.map((inc) => {
      const stats =
        inc.type === "weekly"
          ? {
              completedOrders: weeklyPayout?.completedOrders || 0,
              cancelledOrders: weeklyPayout?.cancelledOrders || 0,
            }
          : {
              completedOrders: dailyPayout?.completedOrders || 0,
              cancelledOrders: dailyPayout?.cancelledOrders || 0,
            };

      const currentSlab = findHighestSlab(inc.slabs, stats.completedOrders);
      const nextSlab = inc.slabs.find((s) => s.minOrders > stats.completedOrders);

      return {
        ...inc,
        progress: {
          ...stats,
          currentSlab: currentSlab || null,
          nextSlab: nextSlab || null,
          ordersToNextSlab: nextSlab
            ? nextSlab.minOrders - stats.completedOrders
            : 0,
        },
      };
    });

    return res.status(200).json({ success: true, incentives: result });
  } catch (err) {
    console.error("Get rider incentives error:", err);
    return res.status(500).json({ message: "Failed to fetch incentives" });
  }
});

export default router;
