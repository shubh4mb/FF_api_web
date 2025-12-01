import express from 'express';
import { googleLogin ,signup} from '../controllers/userControllers/authControllers.js';
import {newArrivals,productsDetails,getFilteredProducts , getProductsByMerchantId,getYouMayLikeProducts , getProductsBatch } from '../controllers/userControllers/product.controllers.js';
import {phoneLogin} from '../controllers/userControllers/authControllers.js';
import {addToCart, getCart, clearCart, updateCartQuantity, deleteCartItem} from '../controllers/userControllers/cart.controllers.js';
import {authMiddleware} from '../middleware/jwtAuth.js';
import {createOrder,getAllOrders,initiateReturn,getOrderById} from '../controllers/userControllers/order.controllers.js';
import {body} from 'express-validator'
import {createAddress, getAllAddresses, getSingleAddress, updateAddress, deleteAddress} from '../controllers/userControllers/address.controllers.js';
const router = express.Router();

router.post('/googleLogin',googleLogin);
router.post('/signup',signup);
router.post('/phoneLogin',phoneLogin)

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
router.get('/cart',authMiddleware, getCart);
router.put('/cart/updatequantity', authMiddleware, updateCartQuantity);
router.delete('/cart/clear', authMiddleware, clearCart)
router.delete('/cart/delete/:itemId', deleteCartItem);

router.post('/order/create', authMiddleware, createOrder);
router.get('/order/getAllOrders', authMiddleware,getAllOrders)
router.get('/order/:orderId', authMiddleware, getOrderById);
router.post('/order/initiateReturn/:orderId', authMiddleware, initiateReturn);
// router.post('/order/orderRequestForMerchant', authMiddleware, orderRequestForMerchant);

// router.delete('/cart/delete/:itemId', deleteCartItem);

router.post("/address/add", authMiddleware, createAddress);
router.get("/address/getAllAddress", authMiddleware, getAllAddresses);
router.get("/address/:id", authMiddleware, getSingleAddress);
router.put("/address/:id", authMiddleware, updateAddress);
router.delete("/address/:id", authMiddleware, deleteAddress);



export default router;