import Banner from "../../models/banner.model.js";

// ====== PUBLIC/USER ROUTE ======

/**
 * 1. Get Active Banners (Grouped by Type for Frontend)
 */
export const getActiveBanners = async (req, res) => {
    try {
        // Highly optimized query using the compound index: { type: 1, isActive: 1, order: 1 }
        // Only fetch active banners, return plain objects, select only needed fields
        const banners = await Banner.find({ isActive: true })
            .select('title imageUrl type ratio actionUrl order')
            .sort({ order: 1, createdAt: -1 })
            .lean();

        // Group banners by type for easier frontend consumption
        // i.e., { home_hero: [...], category_banner: [...] }
        const groupedBanners = banners.reduce((acc, banner) => {
            const { type } = banner;
            if (!acc[type]) acc[type] = [];
            acc[type].push(banner);
            return acc;
        }, {});

        return res.status(200).json({
            success: true,
            banners: groupedBanners
        });
    } catch (error) {
        console.error("Error fetching active banners:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
