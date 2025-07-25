import express from 'express';
import { googleLogin ,signup} from '../controllers/userControllers/authControllers.js';
import {newArrivals,productsDetails,getFilteredProducts , getProductsByMerchantId} from '../controllers/userControllers/product.controllers.js';
import {phoneLogin} from '../controllers/userControllers/authControllers.js';
const router = express.Router();

router.post('/googleLogin',googleLogin);
router.post('/signup',signup);
router.post('/phoneLogin',phoneLogin)

router.get('/products/newArrivals',newArrivals)
router.post('/products/filtered',getFilteredProducts)
router.get('/products/:id',productsDetails)
router.get('/products/merchant/:merchantId',getProductsByMerchantId)



export default router;