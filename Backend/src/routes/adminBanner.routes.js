import express from "express";
import { createBanner, deleteBanner, getAllBanners, updateBanner } from "../controllers/adminControllers/banner.controllers.js";
import { verifyAdmin } from "../middleware/adminAuth.middleware.js";

const router = express.Router();

import upload from "../middleware/multer.js";

/**
 * @route   POST /api/admin/banners
 * @desc    Create a new banner
 */
router.post("/", verifyAdmin, upload.single("image"), createBanner);

/**
 * @route   GET /api/admin/banners
 * @desc    Get all banners (including inactive)
 */
router.get("/", verifyAdmin, getAllBanners);

/**
 * @route   PATCH /api/admin/banners/:id
 * @desc    Update a banner (e.g., active status, order, URL)
 */
router.patch("/:id", verifyAdmin, upload.single("image"), updateBanner);

/**
 * @route   DELETE /api/admin/banners/:id
 * @desc    Delete a banner
 */
router.delete("/:id", verifyAdmin, deleteBanner);

export default router;
