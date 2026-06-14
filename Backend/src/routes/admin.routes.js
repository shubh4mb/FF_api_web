import express from 'express';
import { addCategory, getCategories, updateCategory, getCategoryById } from '../controllers/adminControllers/category.controllers.js';
import { addMerchant, getMerchants, getMerchantById, updateMerchantById, verifyMerchant } from '../controllers/adminControllers/merchant.controllers.js';
import { addBrand, getBrands } from '../controllers/adminControllers/brand.controllers.js';
import upload, { handleMulterError } from '../middleware/multer.js';
import { getBaseProducts, getVariants, getBaseProductById, addVariant, getProductsByMerchantId, updateMatchingProducts } from '../controllers/adminControllers/product.controllers.js';
import { addTitleBanner } from '../controllers/adminControllers/titleBanner.controllers.js';
import { addCart, getCart } from '../controllers/adminControllers/cart.controllers.js';
import { addZone, getAllZones, checkZoneOverlap, updateZone, deleteZone } from '../controllers/adminControllers/zone.controllers.js';
import { getAppConfig, updateAppConfig } from '../controllers/adminControllers/appConfig.controllers.js';
import { getDashboardStats } from '../controllers/adminControllers/dashboard.controllers.js';
import { verifyAdmin } from '../middleware/adminAuth.middleware.js';
import adminBannerRoutes from './adminBanner.routes.js';
import { createAttribute, getAttributes, updateAttribute, deleteAttribute } from '../controllers/adminControllers/attribute.controllers.js';
import { addHub, getAllHubs, updateHub, deleteHub } from '../controllers/adminControllers/hub.controllers.js';
import { createOffer, getAllOffers, getOfferById, updateOffer, toggleOffer, deleteOffer, getAllOffersOverview } from '../controllers/adminControllers/offer.controllers.js';
import { createCollection, getAllCollections, updateCollection, deleteCollection } from '../controllers/adminControllers/collection.controllers.js';
import { createIncentive, getAllIncentives, updateIncentive, toggleIncentive, deleteIncentive } from '../controllers/adminControllers/incentive.controllers.js';
import { getPayouts, triggerPayout, getPayoutById } from '../controllers/adminControllers/payout.controllers.js';
import { getCancellationRequests, adminCancelOrder } from '../controllers/adminControllers/order.controllers.js';

const router = express.Router();

router.use('/banners', adminBannerRoutes);

// ── Dashboard Stats ──
router.get('/dashboard/stats', verifyAdmin, getDashboardStats);

// ── Categories ──
router.post('/addCategory', verifyAdmin, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'logo_MEN', maxCount: 1 },
    { name: 'logo_WOMEN', maxCount: 1 },
    { name: 'logo_KIDS', maxCount: 1 },
    { name: 'title_banners', maxCount: 5 }
]), handleMulterError, addCategory);
router.get('/getCategories', getCategories);
router.get('/getCategoryById/:id', getCategoryById);
router.patch('/updateCategory/:id', verifyAdmin, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'logo_MEN', maxCount: 1 },
    { name: 'logo_WOMEN', maxCount: 1 },
    { name: 'logo_KIDS', maxCount: 1 },
    { name: 'title_banners', maxCount: 5 }
]), handleMulterError, updateCategory);

// ── Collections (Standardized & Prioritized) ──
router.post('/addCollection', verifyAdmin, upload.single('bannerImage'), handleMulterError, createCollection);
router.get('/getCollections', verifyAdmin, getAllCollections);
router.patch('/updateCollection/:id', verifyAdmin, upload.single('bannerImage'), handleMulterError, updateCollection);
router.delete('/deleteCollection/:id', verifyAdmin, deleteCollection);

// ── Merchants ──
router.post('/addMerchant', verifyAdmin, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'backgroundImage', maxCount: 1 }]), handleMulterError, addMerchant);
router.get('/getMerchants', getMerchants);
router.get('/getMerchant/:id', getMerchantById);
router.patch('/updateMerchant/:id', verifyAdmin, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'backgroundImage', maxCount: 1 }]), handleMulterError, updateMerchantById);
router.patch('/updateMerchant/:id/verify', verifyAdmin, verifyMerchant);

// ── Brands ──
router.post('/brand/add', verifyAdmin, upload.single('logo'), handleMulterError, addBrand);
router.get('/brand/get', verifyAdmin, getBrands);

// ── Products ──
router.get('/getBaseProducts', getBaseProducts);
router.get('/getVariants', getVariants);
router.get('/getBaseProductById/:productId', getBaseProductById);
router.post('/addVariant/:productId', upload.array('images'), handleMulterError, addVariant);
router.get('/products/merchant/:merchantId', getProductsByMerchantId);
router.put('/updateMatchingProducts/:productId', updateMatchingProducts);

router.post('/titleBanner/add', verifyAdmin, upload.single('image'), handleMulterError, addTitleBanner);

// ── Cart ──
router.post('/cart/add', verifyAdmin, addCart);
router.get('/cart', verifyAdmin, getCart);

// ── Zones ──
router.post('/zone/add', verifyAdmin, addZone);
router.get('/zone', verifyAdmin, getAllZones);
router.post('/zone/check-overlap', verifyAdmin, checkZoneOverlap);
router.put('/zone/:id', verifyAdmin, updateZone);
router.delete('/zone/:id', verifyAdmin, deleteZone);

// ── App Config ──
router.get('/config', verifyAdmin, getAppConfig);
router.put('/config', verifyAdmin, updateAppConfig);

// ── Attributes ──
router.post('/attributes', verifyAdmin, createAttribute);
router.get('/attributes', getAttributes);
router.patch('/attributes/:id', verifyAdmin, updateAttribute);
router.delete('/attributes/:id', verifyAdmin, deleteAttribute);

// ── Hubs ──
router.post('/hub/add', verifyAdmin, addHub);
router.get('/hub', verifyAdmin, getAllHubs);
router.patch('/hub/:id', verifyAdmin, updateHub);
router.delete('/hub/:id', verifyAdmin, deleteHub);

// ── Offers ──
router.post('/offers', verifyAdmin, createOffer);
router.get('/offers', verifyAdmin, getAllOffers);
router.get('/offers/overview', verifyAdmin, getAllOffersOverview);
router.get('/offers/:id', verifyAdmin, getOfferById);
router.put('/offers/:id', verifyAdmin, updateOffer);
router.patch('/offers/:id/toggle', verifyAdmin, toggleOffer);
router.delete('/offers/:id', verifyAdmin, deleteOffer);

// ── Rider Incentives ──
router.post('/incentives', verifyAdmin, createIncentive);
router.get('/incentives', verifyAdmin, getAllIncentives);
router.put('/incentives/:id', verifyAdmin, updateIncentive);
router.patch('/incentives/:id/toggle', verifyAdmin, toggleIncentive);
router.delete('/incentives/:id', verifyAdmin, deleteIncentive);

// ── Weekly Payouts ──
router.get('/payouts', verifyAdmin, getPayouts);
router.get('/payouts/:id', verifyAdmin, getPayoutById);
router.post('/payouts/trigger', verifyAdmin, triggerPayout);

// ── Support Tickets ──
import SupportTicket from '../models/supportTicket.model.js';

router.get('/support/tickets', verifyAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate("userId", "name phone")
        .populate("orderId", "orderStatus totalAmount")
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Admin get support tickets error:", err);
    return res.status(500).json({ message: "Failed to fetch support tickets" });
  }
});

router.patch('/support/tickets/:id', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.status(200).json({ success: true, ticket });
  } catch (err) {
    console.error("Admin update ticket error:", err);
    return res.status(500).json({ message: "Failed to update ticket" });
  }
});

router.get('/support/stats', verifyAdmin, async (req, res) => {
  try {
    const [open, inProgress, resolved, total] = await Promise.all([
      SupportTicket.countDocuments({ status: "open" }),
      SupportTicket.countDocuments({ status: "in_progress" }),
      SupportTicket.countDocuments({ status: "resolved" }),
      SupportTicket.countDocuments({}),
    ]);
    return res.status(200).json({ success: true, stats: { open, inProgress, resolved, total } });
  } catch (err) {
    console.error("Admin support stats error:", err);
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ── Order Cancellations ──
router.get('/orders/cancellation-requests', verifyAdmin, getCancellationRequests);
router.patch('/orders/:orderId/cancel', verifyAdmin, adminCancelOrder);

// ── Zip Covers ──
import zipCoverRoutes from './adminRoutes/zipCover.routes.js';
router.use('/zip-covers', verifyAdmin, zipCoverRoutes);

export default router;

