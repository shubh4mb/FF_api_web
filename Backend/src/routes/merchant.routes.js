import express from 'express'
import upload, { handleMulterError } from '../middleware/multer.js'
import { addBaseProduct, addVariant, getBaseProducts, getVariants, updateVariant, updateSize, deleteVariantSizes, updateSizeCount } from '../controllers/merchantController/product.controllers.js';
import { deleteVariant, addBrand, getBrands, getBaseProductById, getProductsByMerchantId, uploadProductImage, deleteImage, deleteProduct, updatePrice, editProduct, editVariant, updateVariantSizeStock, updateMultipleVariantSizes, getAllBrands } from '../controllers/merchantController/product.controllers.js';

import { addMerchant } from '../controllers/merchantController/merchant.controller.js';
import { loginMerchant, registerMerchant, updateMerchantShopDetails, updateMerchantBankDetails, updateMerchantOperatingHours, activateMerchant, registerPhone, sendEmailOtp, verifyEmailOtp, getMerchantByEmail } from '../controllers/merchantController/authControllers.js';
import { getAllOrder, saveProductDetails } from '../controllers/merchantController/order.controllers.js';
import { authMiddlewareMerchant } from '../middleware/jwtAuth.js';
import { getWalletDetails } from '../helperFns/walletHelper.js';
import { getPlacedOrder, orderRequestForMerchant, orderPacked } from '../controllers/merchantController/order.controllers.js';
import { getMerchantById } from '../controllers/merchantController/merchant.controller.js';
import { getMerchantAnalytics } from '../controllers/merchantController/analytics.controller.js';

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

router.put("/:merchantId/shop-details", upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'backgroundImage', maxCount: 1 }]), handleMulterError, updateMerchantShopDetails);
router.put("/:merchantId/bank-details", updateMerchantBankDetails);
router.put("/:merchantId/operating-hours", updateMerchantOperatingHours);
router.put("/:merchantId/activate", activateMerchant);

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

router.post('/addBaseProduct', addBaseProduct);
router.delete('/deleteProduct/:productId', deleteProduct);

router.get('/getBaseProducts', getBaseProducts);

router.get('/getBaseProductById/:productId', getBaseProductById);
router.get('/fetchProductsByMerchantId/:merchantId', getProductsByMerchantId);
router.get('/getVariants', getVariants);
router.get('/getCategories', getCategories);
router.get('/attributes', getAttributes);
router.get('/brand/getAllBrands', getAllBrands);

router.post("/upload/image", upload.array("images", 5), handleMulterError, uploadProductImage)
router.delete('/deleteImage/:imageId', deleteImage);

router.post('/addVariant/:productId', upload.array('images'), handleMulterError, addVariant);
router.delete('/deleteVariant/:productId/:variantId', deleteVariant);
router.delete("/deleteSizes/:productId/:variantId/:sizeId", deleteVariantSizes);
router.patch("/updateVariant/:productId/:variantId", upload.array("images"), handleMulterError, updateVariant);
router.put("/updateStock/:productId/:variantId/:sizeId", updateSize);
router.put("/updateStock/:productId/:variantId/:sizeId", updateSizeCount);
router.put("/updateStock/:productId/:variantId", updateSize);
router.put("/updatePrice/:productId/:variantId", updatePrice);

router.patch('/editProduct/:id', editProduct)
// router.patch('/editVariant/:productId/:variantId',editVariant)
router.patch('/updateVariantSizeStock/:productId/:variantId/:sizeName', updateVariantSizeStock)
router.patch('/updateMultipleVariantSizes/:productId/:variantId', updateMultipleVariantSizes)


router.get('/getAllOrders', authMiddlewareMerchant, getAllOrder)
router.put('/orderRequestForMerchant/:orderId', authMiddlewareMerchant, orderRequestForMerchant)
router.get('/getPlacedOrder', authMiddlewareMerchant, getPlacedOrder)
router.post('/order/packed/:orderId', authMiddlewareMerchant, orderPacked)

router.put('/products/:id/details', saveProductDetails);

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

export default router;
