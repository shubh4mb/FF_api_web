import { trendingProducts, recommendedProducts, newArrivals } from './product.controllers.js';
import { getActiveBanners } from './banner.controllers.js';
import { getCollectionsForHome } from './collection.controllers.js';
import { getNearbyMerchants } from './merchant.controllers.js';

/**
 * ── Get Home Feed Aggregated ──
 * Calls multiple existing controllers using a mock response object to return 
 * all home screen data in a single request, avoiding the 429 rate limit 
 * and drastically improving mobile performance.
 */
export const getHomeFeed = async (req, res) => {
    try {
        const createMockRes = () => {
            const mRes = {};
            mRes.statusCode = 200;
            mRes.data = null;
            mRes.status = (code) => { mRes.statusCode = code; return mRes; };
            mRes.json = (payload) => { mRes.data = payload; return mRes; };
            return mRes;
        };

        const resTrending = createMockRes();
        const resRecommended = createMockRes();
        const resNewArrivals = createMockRes();
        const resBanners = createMockRes();
        const resCollections = createMockRes();
        const resMerchants = createMockRes();
        
        // Ensure merchants call uses strict mode to fetch only nearby online merchants
        const reqMerchants = { ...req, query: { ...req.query, strict: 'true' } };

        await Promise.all([
            trendingProducts(req, resTrending),
            recommendedProducts(req, resRecommended),
            newArrivals(req, resNewArrivals),
            getActiveBanners(req, resBanners),
            getCollectionsForHome(req, resCollections),
            getNearbyMerchants(reqMerchants, resMerchants)
        ]);

        return res.status(200).json({
            trending: resTrending.data,
            recommended: resRecommended.data,
            newArrivals: resNewArrivals.data,
            banners: resBanners.data,
            collections: resCollections.data,
            merchants: resMerchants.data
        });

    } catch (error) {
        console.error("Home feed aggregation error:", error);
        return res.status(500).json({ message: "Failed to fetch aggregated home feed" });
    }
};
