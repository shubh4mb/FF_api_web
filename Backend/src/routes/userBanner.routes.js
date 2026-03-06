import express from "express";
import { getActiveBanners } from "../controllers/userControllers/banner.controllers.js";

const router = express.Router();

/**
 * @route   GET /api/user/banners
 * @desc    Get all active banners natively grouped by type for the frontend
 */
router.get("/", getActiveBanners);

export default router;
