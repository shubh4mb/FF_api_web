import express from 'express'
import upload , {handleMulterError} from '../middleware/multer.js'
import { addBaseProduct , addVariant, getBaseProducts, getVariants } from '../controllers/merchantController/product.controllers.js';
import { addMerchant } from '../controllers/merchantController/merchant.controller.js';
const router = express.Router();

router.post('/addBaseProduct',addBaseProduct);
router.post('/addVariant/:productId',upload.array('images'),handleMulterError,addVariant);
router.get('/getBaseProducts',getBaseProducts);
router.get('/getVariants',getVariants);

router.post('/add',addMerchant)
export default router;
