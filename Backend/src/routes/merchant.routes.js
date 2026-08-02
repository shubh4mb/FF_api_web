import express from 'express'
import upload, { handleMulterError } from '../middleware/multer.js'
import { addBaseProduct, addVariant, getBaseProducts, getVariants, updateVariant, updateSize, deleteVariantSizes, updateSizeCount, createProductFull, searchBaseProducts } from '../controllers/merchantController/product.controllers.js';
import { deleteVariant, addBrand, getBrands, getBaseProductById, getProductsByMerchantId, uploadProductImage, deleteImage, deleteProduct, updatePrice, editProduct, editVariant, updateVariantSizeStock, updateMultipleVariantSizes, getAllBrands, bulkUploadProducts } from '../controllers/merchantController/product.controllers.js';

import { addMerchant } from '../controllers/merchantController/merchant.controller.js';
import { loginMerchant, registerMerchant, updateMerchantShopDetails, updateMerchantBankDetails, updateMerchantKYC, updateMerchantOperatingHours, activateMerchant, registerPhone, sendEmailOtp, verifyEmailOtp, getMerchantByEmail, toggleMerchantOnlineStatus, refreshMerchantToken, logoutMerchant, addPushToken } from '../controllers/merchantController/authControllers.js';
import { getAllOrder, saveProductDetails, requestOrderCancellation, getMyWarehouseSales } from '../controllers/merchantController/order.controllers.js';
import { authMiddlewareMerchant } from '../middleware/jwtAuth.js';
import { getWalletDetails } from '../helperFns/walletHelper.js';
import { getPlacedOrder, orderRequestForMerchant, orderPacked, getPackingPhotos, uploadPackingPhoto, deletePackingPhoto, getPackingInfoPublic, reportUnresponsiveRider } from '../controllers/merchantController/order.controllers.js';
import { getMerchantById } from '../controllers/merchantController/merchant.controller.js';
import { getMerchantAnalytics } from '../controllers/merchantController/analytics.controller.js';
import { getMerchantCourierOrders, updateCourierOrderStatus, updateCourierOrderReturnStatus } from '../controllers/userControllers/courierOrder.controllers.js';
import { getAllCollections } from '../controllers/adminControllers/collection.controllers.js';
import WeeklyPayout from '../models/weeklyPayout.model.js';
import { getCurrentWeekBounds } from '../helperFns/weeklyPayoutHelper.js';
import Notification from '../models/notification.model.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Merchant
 *   description: Merchant management and product APIs
 */

/**
 * @swagger
 * /api/merchant/auth/send-email-otp:
 *   post:
 *     summary: Send OTP to merchant email for registration/login
 *     tags: [Merchant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent
 */
router.post('/auth/send-email-otp', sendEmailOtp);

/**
 * @swagger
 * /api/merchant/auth/verify-email-otp:
 *   post:
 *     summary: Verify OTP sent to merchant email
 *     tags: [Merchant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 */
router.post('/auth/verify-email-otp', verifyEmailOtp);

/**
 * @swagger
 * /api/merchant/auth/refresh:
 *   post:
 *     summary: Refresh Merchant Token
 *     tags: [Merchant]
 */
router.post('/auth/refresh', refreshMerchantToken);
router.post('/auth/logout', logoutMerchant);

/**
 * @swagger
 * /api/merchant/getMerchant:
 *   get:
 *     summary: Get current logged in merchant details
 *     tags: [Merchant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Merchant details retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/getMerchant', authMiddlewareMerchant, getMerchantById)
// router.get('/:ema:merchantIdil',getMerchantByEmail)

router.put("/:merchantId/shop-details", authMiddlewareMerchant, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'backgroundImage', maxCount: 1 }]), handleMulterError, updateMerchantShopDetails);
router.put("/:merchantId/bank-details", authMiddlewareMerchant, updateMerchantBankDetails);
router.put("/:merchantId/kyc", authMiddlewareMerchant, upload.fields([
    { name: 'panImage', maxCount: 1 },
    { name: 'gstImage', maxCount: 1 },
    { name: 'businessProofImage', maxCount: 1 },
    { name: 'bankProofImage', maxCount: 1 }
]), handleMulterError, updateMerchantKYC);
router.put("/:merchantId/operating-hours", authMiddlewareMerchant, updateMerchantOperatingHours);
router.put("/:merchantId/activate", activateMerchant);
router.patch("/:merchantId/toggle-online", authMiddlewareMerchant, toggleMerchantOnlineStatus);
router.put('/push-token', authMiddlewareMerchant, addPushToken);

import { createRegistrationFeeOrder, verifyRegistrationFeePayment, getRegistrationFee } from '../controllers/merchantController/payment.controllers.js';
router.get('/registration-fee/amount', getRegistrationFee);
router.post('/:merchantId/registration-fee/create-order', authMiddlewareMerchant, createRegistrationFeeOrder);
router.post('/:merchantId/registration-fee/verify', authMiddlewareMerchant, verifyRegistrationFeePayment);

/**
 * @swagger
 * /api/merchant/login:
 *   post:
 *     summary: Merchant login
 *     tags: [Merchant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Merchant logged in successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/login', loginMerchant);

/**
 * @swagger
 * /api/merchant/register:
 *   post:
 *     summary: Register a new merchant
 *     tags: [Merchant]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               shopName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Merchant registered successfully
 *       400:
 *         description: Bad request
 */
router.post('/register', registerMerchant);



import { getCategories } from '../controllers/adminControllers/category.controllers.js';
import { getAttributes } from '../controllers/adminControllers/attribute.controllers.js';

router.post('/brand/add', upload.single('logo'), handleMulterError, addBrand);
router.get('/brand/get/', getBrands);

router.post('/addBaseProduct', authMiddlewareMerchant, addBaseProduct);
router.post('/bulk-upload', authMiddlewareMerchant, bulkUploadProducts);
router.delete('/deleteProduct/:productId', authMiddlewareMerchant, deleteProduct);

router.get('/getBaseProducts', getBaseProducts);

router.get('/getBaseProductById/:productId', getBaseProductById);
router.get('/fetchProductsByMerchantId/:merchantId', getProductsByMerchantId);
router.get('/getVariants', getVariants);
router.get('/getCategories', getCategories);
router.get('/attributes', getAttributes);
router.get('/brand/getAllBrands', getAllBrands);
router.get('/collections', getAllCollections);

router.post("/upload/image", authMiddlewareMerchant, upload.array("images", 5), handleMulterError, uploadProductImage)
router.delete('/deleteImage/:imageId', authMiddlewareMerchant, deleteImage);

router.post('/addVariant/:productId', authMiddlewareMerchant, upload.array('images'), handleMulterError, addVariant);
router.delete('/deleteVariant/:productId/:variantId', authMiddlewareMerchant, deleteVariant);
router.delete("/deleteSizes/:productId/:variantId/:sizeId", authMiddlewareMerchant, deleteVariantSizes);
router.patch("/updateVariant/:productId/:variantId", authMiddlewareMerchant, upload.array("images"), handleMulterError, updateVariant);
router.put("/updateStock/:productId/:variantId/:sizeId", authMiddlewareMerchant, updateSize);
router.put("/updateStock/:productId/:variantId/:sizeId", authMiddlewareMerchant, updateSizeCount);
router.put("/updateStock/:productId/:variantId", authMiddlewareMerchant, updateSize);
router.put("/updatePrice/:productId/:variantId", authMiddlewareMerchant, updatePrice);

router.patch('/editProduct/:id', authMiddlewareMerchant, editProduct)
// router.patch('/editVariant/:productId/:variantId',editVariant)
router.patch('/updateVariantSizeStock/:productId/:variantId/:sizeName', authMiddlewareMerchant, updateVariantSizeStock)
router.patch('/updateMultipleVariantSizes/:productId/:variantId', authMiddlewareMerchant, updateMultipleVariantSizes)
router.post('/createProductFull', authMiddlewareMerchant, upload.any(), handleMulterError, createProductFull);
router.get('/searchBaseProducts', authMiddlewareMerchant, searchBaseProducts);


router.get('/getAllOrders', authMiddlewareMerchant, getAllOrder)
router.put('/orderRequestForMerchant/:orderId', authMiddlewareMerchant, orderRequestForMerchant)
router.get('/getPlacedOrder', authMiddlewareMerchant, getPlacedOrder)
router.get('/order/:orderId/packing-photos', authMiddlewareMerchant, getPackingPhotos)
router.get('/order/packing-info/:orderId', getPackingInfoPublic)
router.post('/order/packing-photos/upload', upload.single('image'), handleMulterError, uploadPackingPhoto)
router.delete('/order/:orderId/packing-photos/:photoId', authMiddlewareMerchant, deletePackingPhoto)
router.post('/order/packed/:orderId', authMiddlewareMerchant, orderPacked)
router.put('/order/:orderId/request-cancellation', authMiddlewareMerchant, requestOrderCancellation);
router.post('/order/report-rider/:orderId', authMiddlewareMerchant, reportUnresponsiveRider);

router.put('/products/:id/details', authMiddlewareMerchant, saveProductDetails);

// ── Courier Orders ──
router.get('/courier/getAllOrders', authMiddlewareMerchant, getMerchantCourierOrders);
router.patch('/courier/order/:orderId/status', authMiddlewareMerchant, updateCourierOrderStatus);
router.patch('/courier/order/:orderId/return/status', authMiddlewareMerchant, updateCourierOrderReturnStatus);

// ── Return Issues ──
import { createReturnIssue, getMerchantReturnIssues } from '../controllers/merchantController/returnIssue.controllers.js';
router.post('/return-issues', authMiddlewareMerchant, upload.array('images', 5), handleMulterError, createReturnIssue);
router.get('/return-issues', authMiddlewareMerchant, getMerchantReturnIssues);

// router.post('/updateOrderStatus',updateOrderStatus);
// router.post('orderPacked',authMiddlewareMerchant,orderPacked)  

router.post('/add', addMerchant)

// ── Reviews ──
import { getMerchantOwnReviews } from '../controllers/userControllers/review.controllers.js';
router.get('/reviews', authMiddlewareMerchant, getMerchantOwnReviews);

// ── Analytics ──
router.get('/analytics', authMiddlewareMerchant, getMerchantAnalytics);

// ── Wallet ──
router.get('/wallet', authMiddlewareMerchant, async (req, res) => {
    try {
        const details = await getWalletDetails('merchant', req.merchantId);
        return res.status(200).json({ success: true, ...details });
    } catch (err) {
        console.error('Get merchant wallet error:', err);
        return res.status(500).json({ message: 'Failed to fetch wallet' });
    }
});

// ── Earnings ──
router.get("/earnings/current-week", authMiddlewareMerchant, async (req, res) => {
    try {
        const { weekStart, weekEnd } = getCurrentWeekBounds();

        const payout = await WeeklyPayout.findOne({
            ownerType: "merchant",
            ownerId: req.merchantId,
            weekStart,
        }).lean();

        const dailyBreakdown = [
            { day: 'Mon', amount: 0 },
            { day: 'Tue', amount: 0 },
            { day: 'Wed', amount: 0 },
            { day: 'Thu', amount: 0 },
            { day: 'Fri', amount: 0 },
            { day: 'Sat', amount: 0 },
            { day: 'Sun', amount: 0 }
        ];

        if (payout && payout.orders && payout.orders.length > 0) {
            payout.orders.forEach(order => {
                if (order.settledAt) {
                    // Convert UTC to IST by adding 5.5 hours, assuming week bounds are based on IST.
                    // Or simply use the UTC date since the week bounds and logic in weeklyPayoutHelper
                    // ensures the orders belong to this week.
                    const date = new Date(order.settledAt);
                    const dayIndex = date.getDay(); // 0 is Sun, 1 is Mon...
                    const mappedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                    const val = order.type === 'credit' ? order.amount : -order.amount;
                    dailyBreakdown[mappedIndex].amount += val;
                }
            });
        }

        return res.status(200).json({
            success: true,
            weekStart,
            weekEnd,
            dailyBreakdown,
            payout: payout || {
                totalEarnings: 0,
                totalDeductions: 0,
                netPayout: 0,
                completedOrders: 0,
                finalAmount: 0,
                status: "accumulating",
                orders: [],
            },
        });
    } catch (err) {
        console.error("Get merchant current week error:", err);
        return res.status(500).json({ message: "Failed to fetch current week earnings" });
    }
});

router.get("/earnings/history", authMiddlewareMerchant, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const payouts = await WeeklyPayout.find({
            ownerType: "merchant",
            ownerId: req.merchantId,
            status: { $in: ["paid", "failed"] },
        })
            .sort({ weekStart: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        const total = await WeeklyPayout.countDocuments({
            ownerType: "merchant",
            ownerId: req.merchantId,
            status: { $in: ["paid", "failed"] },
        });

        return res.status(200).json({
            success: true,
            payouts,
            pagination: { page: parseInt(page), limit: parseInt(limit), total },
        });
    } catch (err) {
        console.error("Get merchant earnings history error:", err);
        return res.status(500).json({ message: "Failed to fetch earnings history" });
    }
});

// ── Offers ──
import { createMerchantOffer, getMyOffers, updateMerchantOffer, toggleMerchantOffer, deleteMerchantOffer } from '../controllers/merchantController/offer.controllers.js';
router.post('/offers', authMiddlewareMerchant, createMerchantOffer);
router.get('/offers', authMiddlewareMerchant, getMyOffers);
router.put('/offers/:id', authMiddlewareMerchant, updateMerchantOffer);
router.patch('/offers/:id/toggle', authMiddlewareMerchant, toggleMerchantOffer);
router.delete('/offers/:id', authMiddlewareMerchant, deleteMerchantOffer);

// ── Zip Covers ──
import zipCoverRoutes from './merchantRoutes/zipCover.routes.js';
router.use('/zip-covers', zipCoverRoutes);

// ── Notifications ──

router.get("/notifications", authMiddlewareMerchant, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const notifications = await Notification.find({ merchantId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.status(200).json({ success: true, notifications });
    } catch (err) {
        console.error("Merchant get notifications error:", err);
        return res.status(500).json({ message: "Failed to fetch notifications" });
    }
});

router.patch("/notifications/:id", authMiddlewareMerchant, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, merchantId: req.merchantId },
            { read: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: "Not found" });
        return res.status(200).json({ success: true, notification });
    } catch (err) {
        return res.status(500).json({ message: "Failed to update notification" });
    }
});

// ── Warehouse Sales (Merchant view of their consignment sales) ──
router.get('/warehouse-sales', authMiddlewareMerchant, getMyWarehouseSales);

// ── Warehouse Operator Routes (accountType = 'warehouse') ──
import {
  getWarehousePlacedOrders,
  getAllWarehouseOrdersForOperator,
  getWarehouseOrderDetailForOperator,
  acceptWarehouseOrder,
  rejectWarehouseOrder,
  markWarehouseOrderPacked,
  uploadWarehousePackingPhoto,
  getWarehouseOperatorStats,
} from '../controllers/merchantController/warehouseOrder.controllers.js';

import {
  getMyWarehouseProducts,
  addMyWarehouseProduct,
  addMyWarehouseProductVariant,
  updateMyWarehouseProductStock,
  deleteMyWarehouseProduct,
  updateMyWarehouseProduct,
  createWarehouseProductFull,
  getMyConsignedWarehouseStock,
  applyForWarehouseService,
} from '../controllers/merchantController/warehouseProduct.controllers.js';

import { getAssignedMerchants } from '../controllers/merchantController/operator.controllers.js';

router.get('/warehouse-orders/stats', authMiddlewareMerchant, getWarehouseOperatorStats);
router.get('/warehouse-orders/placed', authMiddlewareMerchant, getWarehousePlacedOrders);
router.get('/warehouse-orders/all', authMiddlewareMerchant, getAllWarehouseOrdersForOperator);
router.get('/warehouse-orders/:orderId', authMiddlewareMerchant, getWarehouseOrderDetailForOperator);
router.patch('/warehouse-orders/:orderId/accept', authMiddlewareMerchant, acceptWarehouseOrder);
router.patch('/warehouse-orders/:orderId/reject', authMiddlewareMerchant, rejectWarehouseOrder);
router.patch('/warehouse-orders/:orderId/packed', authMiddlewareMerchant, markWarehouseOrderPacked);
router.post(
  '/warehouse-orders/:orderId/packing-photo',
  authMiddlewareMerchant,
  upload.single('photo'),
  handleMulterError,
  uploadWarehousePackingPhoto
);

// Warehouse operator assigned merchants
router.get('/assigned-merchants', authMiddlewareMerchant, getAssignedMerchants);

// Warehouse operator product listings & stock management
router.post('/apply-warehouse', authMiddlewareMerchant, applyForWarehouseService);
router.get('/my-consigned-stock', authMiddlewareMerchant, getMyConsignedWarehouseStock);
router.get('/warehouse-products', authMiddlewareMerchant, getMyWarehouseProducts);
router.post('/warehouse-products/add', authMiddlewareMerchant, addMyWarehouseProduct);
router.post('/warehouse-products/full', authMiddlewareMerchant, upload.any(), createWarehouseProductFull);
router.post(
  '/warehouse-products/:warehouseProductId/variants',
  authMiddlewareMerchant,
  upload.array('images', 5),
  handleMulterError,
  addMyWarehouseProductVariant
);
router.patch('/warehouse-products/:warehouseProductId', authMiddlewareMerchant, updateMyWarehouseProduct);
router.patch('/warehouse-products/:warehouseProductId/stock', authMiddlewareMerchant, updateMyWarehouseProductStock);
router.delete('/warehouse-products/:warehouseProductId', authMiddlewareMerchant, deleteMyWarehouseProduct);

export default router;
