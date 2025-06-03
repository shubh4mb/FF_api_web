import express from 'express'
import upload , {handleMulterError} from '../middleware/multer.js'
import { addProduct } from '../controllers/merchantController/product.controllers.js';
import { addMerchant } from '../controllers/merchantController/merchant.controller.js';
const router = express.Router();

router.post('/addProduct',addProduct);

router.post('/add',addMerchant)
export default router;
