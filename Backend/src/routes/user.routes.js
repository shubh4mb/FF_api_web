import express from 'express';
import { googleLogin ,signup} from '../controllers/userControllers/authControllers.js';
import {newArrivals,productsDetails} from '../controllers/userControllers/product.controllers.js';
const router = express.Router();

router.post('/googleLogin',googleLogin);
router.post('/signup',signup);

router.get('/products/newArrivals',newArrivals)
router.get('/products/:id',productsDetails)

export default router;