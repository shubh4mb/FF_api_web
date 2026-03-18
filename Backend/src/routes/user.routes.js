import express from 'express';
import { googleLogin, signup } from '../controllers/userControllers/authControllers.js';
import { newArrivals, productsDetails, getFilteredProducts, getProductsByMerchantId, getYouMayLikeProducts, getProductsBatch, trendingProducts, recommendedProducts } from '../controllers/userControllers/product.controllers.js';
import { phoneLogin, addPushToken } from '../controllers/userControllers/authControllers.js';
import { addToCart, getCart, clearCart, updateCartQuantity, deleteCartItem, getCartCount } from '../controllers/userControllers/cart.controllers.js';
import { authMiddleware } from '../middleware/jwtAuth.js';
import { getAllOrders, initiateReturn, getOrderById, createRazorpayOrder, verifyPayment, razorpayWebhook, createFinalPaymentRazorpayOrder, verifyFinalPayment } from '../controllers/userControllers/order.controllers.js';
import { body } from 'express-validator'
import { createAddress, getAllAddresses, getSingleAddress, updateAddress, deleteAddress } from '../controllers/userControllers/address.controllers.js';
import {
  addToWishlist,
  removeFromWishlist,
  getMyWishlist,
  getMyWishlistIds,
} from '../controllers/userControllers/wishlist.controllers.js';
import { checkDeliveryAvailability } from '../controllers/adminControllers/zone.controllers.js';
import Notification from "../models/notification.model.js";
import { getWalletDetails } from "../helperFns/walletHelper.js";

import userBannerRoutes from './userBanner.routes.js';

const router = express.Router();

router.use('/banners', userBannerRoutes);


// ── Notifications ──

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

router.get("/wallet", authMiddleware, async (req, res) => {
  try {
    const details = await getWalletDetails("user", req.user.userId);
    return res.status(200).json({ success: true, ...details });
  } catch (err) {
    console.error("Get wallet error:", err);
    return res.status(500).json({ message: "Failed to fetch wallet" });
  }
});

router.post('/googleLogin', googleLogin);
router.post('/signup', signup);
router.post('/phoneLogin', phoneLogin)
router.post('/checkDeliveryAvailability', checkDeliveryAvailability);

router.put('/push-token', authMiddleware, addPushToken);

router.get('/products/newArrivals', newArrivals)
router.get('/products/trending', trendingProducts);
router.get('/products/recommended', authMiddleware, recommendedProducts); // requires auth for cart/wishlist
router.post('/products/filtered', getFilteredProducts)
router.get('/products/getYouMayLikeProducts', getYouMayLikeProducts);
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

router.post('/cart/add', authMiddleware, addToCart);
router.get('/cartCount', authMiddleware, getCartCount);
router.post('/cart', authMiddleware, getCart);

router.put('/cart/updatequantity', authMiddleware, updateCartQuantity);
router.delete('/cart/clear', authMiddleware, clearCart)
router.delete('/cart/delete/:itemId', deleteCartItem);

// Add product to wishlist
router.post('/wishlist/add', authMiddleware, addToWishlist);
// Remove product from wishlist
router.delete('/wishlist/delete/:wishlistItemId', authMiddleware, removeFromWishlist);
// Get current user's full wishlist
router.get('/wishlist/my', authMiddleware, getMyWishlist);

router.get('/wishlist/ids', authMiddleware, getMyWishlistIds);
// Check if a product is already in wishlist (for heart icon)
// router.get('/wishlist/check/:productId',authMiddleware, isProductInWishlist);

// router.post('/order/create', authMiddleware, createOrder);
router.post('/order/create', authMiddleware, createRazorpayOrder);
router.post('/order/verifyPayment', authMiddleware, verifyPayment);
router.post('/webhook/razorpay', razorpayWebhook);
router.get('/order/getAllOrders', authMiddleware, getAllOrders)
router.get('/order/:orderId', authMiddleware, getOrderById);
router.post('/order/initiateReturn/:orderId', authMiddleware, initiateReturn);
// router.post('/order/orderRequestForMerchant', authMiddleware, orderRequestForMerchant);

router.post('/order/createFinalPaymentOrder/:orderId', authMiddleware, createFinalPaymentRazorpayOrder);
router.post('/order/verifyFinalPayment', authMiddleware, verifyFinalPayment);

// router.delete('/cart/delete/:itemId', deleteCartItem);

router.post("/address/add", authMiddleware, createAddress);
router.get("/address/getAllAddress", authMiddleware, getAllAddresses);
router.get("/address/:id", authMiddleware, getSingleAddress);
router.put("/address/:id", authMiddleware, updateAddress);
router.delete("/address/:id", authMiddleware, deleteAddress);

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
