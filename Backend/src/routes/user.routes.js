import express from 'express';
import { googleLogin ,signup} from '../controllers/userControllers/authControllers.js';
import {newArrivals,productsDetails,getFilteredProducts , getProductsByMerchantId,getYouMayLikeProducts } from '../controllers/userControllers/product.controllers.js';
import {phoneLogin} from '../controllers/userControllers/authControllers.js';
import {addToCart, getCart, clearCart, updateCartQuantity, deleteCartItem} from '../controllers/userControllers/cart.controllers.js';
import {authMiddleware} from '../middleware/jwtAuth.js';
import {createOrder,orderRequestForMerchant} from '../controllers/userControllers/order.controllers.js';
const router = express.Router();

router.post('/googleLogin',googleLogin);
router.post('/signup',signup);
router.post('/phoneLogin',phoneLogin)

router.get('/products/newArrivals',newArrivals)
router.post('/products/filtered',getFilteredProducts)
router.get('/products/getYouMayLikeProducts', getYouMayLikeProducts);
router.get('/products/:id',productsDetails)
router.get('/products/merchant/:merchantId',getProductsByMerchantId)

router.post('/cart/add',authMiddleware,addToCart);
router.get('/cart',authMiddleware, getCart);
router.put('/cart/updatequantity', authMiddleware, updateCartQuantity);
router.delete('/cart/clear', authMiddleware, clearCart)
router.delete('/cart/delete/:itemId', deleteCartItem);

router.post('/order/create', authMiddleware, createOrder);
router.post('/order/orderRequestForMerchant', authMiddleware, orderRequestForMerchant);

// router.delete('/cart/delete/:itemId', deleteCartItem);



export default router;