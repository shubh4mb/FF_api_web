import express from 'express';
import { addCategory, getCategories, updateCategory } from '../controllers/adminControllers/category.controller.js';
import { addMerchant, getMerchants } from '../controllers/adminControllers/merchant.controller.js';
import { addBrand,getBrands } from '../controllers/adminControllers/brand.js';
import upload , {handleMulterError} from '../middleware/multer.js'
const router = express.Router();

router.post('/addCategory',upload.single('image'),handleMulterError,addCategory);
router.get('/getCategories',getCategories);
router.patch('/updateCategory/:id',upload.single('image'),handleMulterError,updateCategory);   


router.post('/addMerchant',addMerchant);
router.get('/getMerchants',getMerchants);

router.post('/brand/add',upload.single('logo'),handleMulterError,addBrand);
router.get('/brand/get',getBrands);

// router.delete('/deleteCategory/:id',deleteCategory);

export default router;
