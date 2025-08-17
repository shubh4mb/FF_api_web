import express from 'express'
import upload , {handleMulterError} from '../middleware/multer.js'
import { addBaseProduct , addVariant, getBaseProducts, getVariants,getCategories, addBrand, getBrands, getBaseProductById , updateVariant, getProductsByMerchantId, uploadProductImage, deleteImage} from '../controllers/merchantController/product.controllers.js';
import { addMerchant } from '../controllers/merchantController/merchant.controller.js';
import { registerMerchant, loginMerchant } from '../controllers/merchantController/authControllers.js';

const router = express.Router();

router.post('/register', registerMerchant);
router.post('/login', loginMerchant);

router.post('/brand/add',upload.single('logo'),handleMulterError,addBrand);
router.get('/brand/get/',getBrands);

router.post('/addBaseProduct',addBaseProduct);
router.post('/addVariant/:productId',upload.array('images'),handleMulterError,addVariant);
router.put("/updateVariant/:productId/:variantId",upload.array("images"),handleMulterError,updateVariant);
router.get('/getBaseProducts',getBaseProducts);

router.get('/getBaseProductById/:productId',getBaseProductById);
router.get('/fetchProductsByMerchantId/:merchantId', getProductsByMerchantId);
router.get('/getVariants',getVariants);
router.get('/getCategories',getCategories);
router.post("/upload/image",upload.array("images", 5), handleMulterError,uploadProductImage );
router.delete('/deleteImage/:imageId', deleteImage);

router.post('/add',addMerchant)
export default router;
