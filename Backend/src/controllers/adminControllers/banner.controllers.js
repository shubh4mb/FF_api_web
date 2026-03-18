import Banner from "../../models/banner.model.js";
import { uploadToCloudinary } from "../../config/cloudinary.config.js";

// ====== ADMIN ROUTES ======

/**
 * 1. Create a new Banner
 */
export const createBanner = async (req, res) => {
    try {
        const { title, type, ratio, actionUrl, isActive, order } = req.body;
        let imageUrl = req.body.imageUrl;

        // If a file is uploaded, upload it to Cloudinary
        if (req.file) {
            try {
                const result = await uploadToCloudinary(req.file.buffer, {
                    folder: 'banners',
                    resource_type: 'image'
                });
                imageUrl = result.secure_url;
            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                return res.status(500).json({ message: "Failed to upload image to Cloudinary" });
            }
        }

        if (!imageUrl) {
            return res.status(400).json({ message: "imageUrl (or an uploaded image) is required." });
        }

        if (!type || !ratio) {
            return res.status(400).json({ message: "type and ratio are required." });
        }

        const newBanner = new Banner({
            title,
            imageUrl,
            type,
            ratio,
            actionUrl,
            isActive: isActive !== undefined ? isActive : true,
            order: order || 0
        });

        await newBanner.save();
        return res.status(201).json({ message: "Banner created successfully", banner: newBanner });
    } catch (error) {
        console.error("Error creating banner:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * 2. Get All Banners (Admin view - includes inactive)
 */
export const getAllBanners = async (req, res) => {
    try {
        // Optionally filter by type via query param: /api/admin/banners?type=home_hero
        const { type } = req.query;
        const query = type ? { type } : {};

        const banners = await Banner.find(query).sort({ type: 1, order: 1, createdAt: -1 }).lean();
        return res.status(200).json({ banners });
    } catch (error) {
        console.error("Error fetching banners:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * 3. Update Banner
 */
export const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        // If a new file is uploaded, upload it to Cloudinary
        if (req.file) {
            try {
                const result = await uploadToCloudinary(req.file.buffer, {
                    folder: 'banners',
                    resource_type: 'image'
                });
                updates.imageUrl = result.secure_url;
            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                return res.status(500).json({ message: "Failed to upload image to Cloudinary" });
            }
        }

        const updatedBanner = await Banner.findByIdAndUpdate(id, updates, { new: true });

        if (!updatedBanner) {
            return res.status(404).json({ message: "Banner not found" });
        }

        return res.status(200).json({ message: "Banner updated", banner: updatedBanner });
    } catch (error) {
        console.error("Error updating banner:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * 4. Delete Banner
 */
export const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBanner = await Banner.findByIdAndDelete(id);

        if (!deletedBanner) {
            return res.status(404).json({ message: "Banner not found" });
        }

        return res.status(200).json({ message: "Banner deleted successfully" });
    } catch (error) {
        console.error("Error deleting banner:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
