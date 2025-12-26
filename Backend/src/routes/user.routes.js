import express from 'express';
import { googleLogin ,signup} from '../controllers/userControllers/authControllers.js';
import {newArrivals,productsDetails,getFilteredProducts , getProductsByMerchantId,getYouMayLikeProducts , getProductsBatch } from '../controllers/userControllers/product.controllers.js';
import {phoneLogin} from '../controllers/userControllers/authControllers.js';
import {addToCart, getCart, clearCart, updateCartQuantity, deleteCartItem,getCartCount} from '../controllers/userControllers/cart.controllers.js';
import {authMiddleware} from '../middleware/jwtAuth.js';
import {getAllOrders,initiateReturn,getOrderById ,createRazorpayOrder,verifyPayment,razorpayWebhook ,createFinalPaymentRazorpayOrder,verifyFinalPayment} from '../controllers/userControllers/order.controllers.js';
import {body} from 'express-validator'
import {createAddress, getAllAddresses, getSingleAddress, updateAddress, deleteAddress} from '../controllers/userControllers/address.controllers.js';
import {
  addToWishlist,
  removeFromWishlist,
  getMyWishlist,
  getMyWishlistIds,
} from '../controllers/userControllers/wishlist.controllers.js';
const router = express.Router();
import { checkDeliveryAvailability } from '../controllers/adminControllers/zone.controllers.js';


router.post('/googleLogin',googleLogin);
router.post('/signup',signup);
router.post('/phoneLogin',phoneLogin)
router.post('/checkDeliveryAvailability', checkDeliveryAvailability);

router.get('/products/newArrivals',newArrivals)
router.post('/products/filtered',getFilteredProducts)
router.get('/products/getYouMayLikeProducts', getYouMayLikeProducts);
router.get('/products/:id',productsDetails)
router.get('/products/merchant/:merchantId',getProductsByMerchantId)
router.post(
    '/products/batch',
    [
      body('merchantIds').isArray({ min: 1 }).withMessage('merchantIds must be a non-empty array'),
      body('merchantIds.*').isString().withMessage('Each merchantId must be a string')
    ],
    getProductsBatch
  );

router.post('/cart/add',authMiddleware,addToCart);
router.get('/cartCount',authMiddleware, getCartCount);
router.get('/cart/',authMiddleware, getCart);

router.put('/cart/updatequantity', authMiddleware, updateCartQuantity);
router.delete('/cart/clear', authMiddleware, clearCart)
router.delete('/cart/delete/:itemId', deleteCartItem);

// Add product to wishlist
router.post('/wishlist/add',authMiddleware, addToWishlist);
// Remove product from wishlist
  router.delete('/wishlist/delete/:wishlistItemId', authMiddleware,removeFromWishlist);
// Get current user's full wishlist
router.get('/wishlist/my', authMiddleware,getMyWishlist);

router.get('/wishlist/ids', authMiddleware, getMyWishlistIds);
// Check if a product is already in wishlist (for heart icon)
// router.get('/wishlist/check/:productId',authMiddleware, isProductInWishlist);

// router.post('/order/create', authMiddleware, createOrder);
router.post('/order/create', authMiddleware, createRazorpayOrder);
router.post('/order/verifyPayment', authMiddleware, verifyPayment);
router.post('/webhook/razorpay', razorpayWebhook);
router.get('/order/getAllOrders', authMiddleware,getAllOrders)
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



export default router;