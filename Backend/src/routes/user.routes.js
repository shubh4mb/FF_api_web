import express from 'express';
import { googleLogin, signup } from '../controllers/userControllers/authControllers.js';
import { newArrivals, productsDetails, getFilteredProducts, getProductsByMerchantId, getYouMayLikeProducts, getProductsBatch, trendingProducts, recommendedProducts } from '../controllers/userControllers/product.controllers.js';
import { phoneLogin, addPushToken } from '../controllers/userControllers/authControllers.js';
import { addToCart, getCart, clearCart, updateCartQuantity, deleteCartItem, getCartCount } from '../controllers/userControllers/cart.controllers.js';
import { authMiddleware } from '../middleware/jwtAuth.js';
import { getAllOrders, initiateReturn, getOrderById, createRazorpayOrder, verifyPayment, razorpayWebhook, createFinalPaymentRazorpayOrder, verifyFinalPayment, cancelOrder } from '../controllers/userControllers/order.controllers.js';
import { body } from 'express-validator'
import { createAddress, getAllAddresses, getSingleAddress, updateAddress, deleteAddress } from '../controllers/userControllers/address.controllers.js';
import {
  addToWishlist,
  removeFromWishlist,
  getMyWishlist,
  getMyWishlistIds,
} from '../controllers/userControllers/wishlist.controllers.js';
import { addToRecentlyViewed, getMyRecentlyViewed } from '../controllers/userControllers/recentlyViewed.controllers.js';

import { checkDeliveryAvailability } from '../controllers/adminControllers/zone.controllers.js';
import Notification from "../models/notification.model.js";
import { getWalletDetails } from "../helperFns/walletHelper.js";

import userBannerRoutes from './userBanner.routes.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User-facing APIs for products, cart, wishlist, and orders
 */

router.use('/banners', userBannerRoutes);

// ── Notifications ──

/**
 * @swagger
 * /api/user/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return res.status(200).json({ success: true, notifications });
  } catch (err) {
    console.error("Get notifications error:", err);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

router.patch("/notifications/:id", authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Not found" });
    return res.status(200).json({ success: true, notification });
  } catch (err) {
    console.error("Mark read error:", err);
    return res.status(500).json({ message: "Failed to update notification" });
  }
});

router.patch("/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { read: true }
    );
    return res.status(200).json({ success: true, message: "All marked as read" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update" });
  }
});

// ── Wallet ──

/**
 * @swagger
 * /api/user/wallet:
 *   get:
 *     summary: Get user wallet details
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Wallet details
 */
router.get("/wallet", authMiddleware, async (req, res) => {
  try {
    const details = await getWalletDetails("user", req.user.userId);
    return res.status(200).json({ success: true, ...details });
  } catch (err) {
    console.error("Get wallet error:", err);
    return res.status(500).json({ message: "Failed to fetch wallet" });
  }
});

/**
 * @swagger
 * /api/user/googleLogin:
 *   post:
 *     summary: User login with Google
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/googleLogin', googleLogin);

/**
 * @swagger
 * /api/user/signup:
 *   post:
 *     summary: User registration
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: User registered
 */
router.post('/signup', signup);

/**
 * @swagger
 * /api/user/phoneLogin:
 *   post:
 *     summary: User login with phone
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, otp]
 *             properties:
 *               phone: { type: string }
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/phoneLogin', phoneLogin)
router.post('/checkDeliveryAvailability', checkDeliveryAvailability);

router.put('/push-token', authMiddleware, addPushToken);

/**
 * @swagger
 * /api/user/products/newArrivals:
 *   get:
 *     summary: Get new arrival products
 *     tags: [User]
 *     responses:
 *       200:
 *         description: List of new arrivals
 */
router.get('/products/newArrivals', newArrivals)

/**
 * @swagger
 * /api/user/products/trending:
 *   get:
 *     summary: Get trending products
 *     tags: [User]
 *     responses:
 *       200:
 *         description: List of trending products
 */
router.get('/products/trending', trendingProducts);

/**
 * @swagger
 * /api/user/products/recommended:
 *   get:
 *     summary: Get recommended products for the user
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of recommended products
 */
router.get('/products/recommended', authMiddleware, recommendedProducts); // requires auth for cart/wishlist
router.post('/products/filtered', getFilteredProducts)
router.get('/products/getYouMayLikeProducts', getYouMayLikeProducts);

/**
 * @swagger
 * /api/user/products/{id}:
 *   get:
 *     summary: Get product details by ID
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
 */
router.get('/products/:id', productsDetails)
router.get('/products/merchant/:merchantId', getProductsByMerchantId)
router.post(
  '/products/batch',
  [
    body('merchantIds').isArray({ min: 1 }).withMessage('merchantIds must be a non-empty array'),
    body('merchantIds.*').isString().withMessage('Each merchantId must be a string')
  ],
  getProductsBatch
);

/**
 * @swagger
 * /api/user/cart/add:
 *   post:
 *     summary: Add item to cart
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId, sizeId, quantity]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string }
 *               sizeId: { type: string }
 *               quantity: { type: number }
 *     responses:
 *       200:
 *         description: Added to cart
 */
router.post('/cart/add', authMiddleware, addToCart);

/**
 * @swagger
 * /api/user/cartCount:
 *   get:
 *     summary: Get cart item count
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Cart count
 */
router.get('/cartCount', authMiddleware, getCartCount);

/**
 * @swagger
 * /api/user/cart:
 *   post:
 *     summary: Get user cart
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Cart items
 */
router.post('/cart', authMiddleware, getCart);

router.put('/cart/updatequantity', authMiddleware, updateCartQuantity);
router.delete('/cart/clear', authMiddleware, clearCart)
router.delete('/cart/delete/:itemId', deleteCartItem);

/**
 * @swagger
 * /api/user/wishlist/add:
 *   post:
 *     summary: Add product to wishlist
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string }
 *     responses:
 *       200:
 *         description: Added to wishlist
 */
router.post('/wishlist/add', authMiddleware, addToWishlist);
router.delete('/wishlist/delete/:wishlistItemId', authMiddleware, removeFromWishlist);

/**
 * @swagger
 * /api/user/wishlist/my:
 *   get:
 *     summary: Get user wishlist
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Wishlist items
 */
router.get('/wishlist/my', authMiddleware, getMyWishlist);

router.get('/wishlist/ids', authMiddleware, getMyWishlistIds);

// router.post('/order/create', authMiddleware, createOrder);
router.post('/order/create', authMiddleware, createRazorpayOrder);
router.post('/order/verifyPayment', authMiddleware, verifyPayment);
router.post('/webhook/razorpay', razorpayWebhook);

/**
 * @swagger
 * /api/user/order/getAllOrders:
 *   get:
 *     summary: Get all user orders
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/order/getAllOrders', authMiddleware, getAllOrders)
router.get('/order/:orderId', authMiddleware, getOrderById);
router.post('/order/initiateReturn/:orderId', authMiddleware, initiateReturn);

router.post('/order/createFinalPaymentOrder/:orderId', authMiddleware, createFinalPaymentRazorpayOrder);
router.post('/order/verifyFinalPayment', authMiddleware, verifyFinalPayment);
router.post('/order/cancel/:orderId', authMiddleware, cancelOrder);

/**
 * @swagger
 * /api/user/address/getAllAddress:
 *   get:
 *     summary: Get all user addresses
 *     tags: [User]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of addresses
 */
router.post("/address/add", authMiddleware, createAddress);
router.get("/address/getAllAddress", authMiddleware, getAllAddresses);
router.get("/address/:id", authMiddleware, getSingleAddress);
router.put("/address/:id", authMiddleware, updateAddress);
router.delete("/address/:id", authMiddleware, deleteAddress);

// ── Recently Viewed ──
router.post('/recently-viewed/add', authMiddleware, addToRecentlyViewed);
router.get('/recently-viewed/my', authMiddleware, getMyRecentlyViewed);


// ── Reviews ──
import {
  createReview,
  getReviews,
  getMyReviews,
  deleteReview,
  getReviewableItems,
} from '../controllers/userControllers/review.controllers.js';

router.post('/review', authMiddleware, createReview);
router.get('/reviews/my', authMiddleware, getMyReviews);
router.get('/reviews/reviewable', authMiddleware, getReviewableItems);
router.delete('/review/:reviewId', authMiddleware, deleteReview);
router.get('/reviews/:targetType/:targetId', getReviews); // public

export default router;
