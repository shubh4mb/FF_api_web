import express from 'express';
import { addCategory, getCategories, updateCategory } from '../controllers/adminControllers/category.controllers.js';
import { addMerchant, getMerchants , getMerchantById , updateMerchantById} from '../controllers/adminControllers/merchant.controllers.js';
import { addBrand,getBrands } from '../controllers/adminControllers/brand.controllers.js.js';
import upload , {handleMulterError} from '../middleware/multer.js'
import { getBaseProducts, getVariants ,getBaseProductById , addVariant} from '../controllers/adminControllers/product.controllers.js';
import {addTitleBanner} from '../controllers/adminControllers/titleBanner.controllers.js';
import { addCart, getCart, deleteCartItem} from '../controllers/adminControllers/cart.controllers.js';
const router = express.Router();

router.post('/addCategory',upload.single('image'),handleMulterError,addCategory);
router.get('/getCategories',getCategories);
router.patch('/updateCategory/:id',upload.single('image'),handleMulterError,updateCategory);   


router.post('/addMerchant',upload.single('logo'),handleMulterError,addMerchant);
router.get('/getMerchants',getMerchants);
router.get('/getMerchant/:id', getMerchantById);
router.patch('/updateMerchant/:id',upload.single('logo'),handleMulterError,updateMerchantById);


router.post('/brand/add',upload.single('logo'),handleMulterError,addBrand);
router.get('/brand/get',getBrands);

router.get('/getBaseProducts',getBaseProducts);
router.get('/getVariants',getVariants);
router.get('/getBaseProductById/:productId',getBaseProductById);
router.post('/addVariant/:productId',upload.array('images'),handleMulterError,addVariant);


router.post('/titleBanner/add',upload.single('image'),handleMulterError,addTitleBanner)

router.post('/cart/add',addCart);
router.get('/cart', getCart);
// router.put('/cart/updatequantity', updateCartQuantity);
router.delete('/cart/delete/:itemId', deleteCartItem);



export default router;
