import express from 'express'
import upload , {handleMulterError} from '../middleware/multer.js'
import { addBaseProduct , addVariant, getBaseProducts, getVariants,getCategories,updateVariant,updateSize, deleteVariantSizes, updateSizeCount} from '../controllers/merchantController/product.controllers.js';
import { deleteVariant ,addBrand, getBrands, getBaseProductById ,  getProductsByMerchantId, uploadProductImage, deleteImage, deleteProduct, updatePrice} from '../controllers/merchantController/product.controllers.js';

import { addMerchant } from '../controllers/merchantController/merchant.controller.js';
import { registerMerchant, loginMerchant } from '../controllers/merchantController/authControllers.js';

import {orderPacked} from '../controllers/userControllers/order.controllers.js';

import {getOrderForMerchant, saveProductDetails} from '../controllers/merchantController/order.controllers.js';
import {authMiddlewareMerchant} from '../middleware/jwtAuth.js';
const router = express.Router();

router.post('/register', registerMerchant);
router.post('/login', loginMerchant);

router.post('/brand/add',upload.single('logo'),handleMulterError,addBrand);
router.get('/brand/get/',getBrands);

router.post('/addBaseProduct',addBaseProduct);
router.delete('/deleteProduct/:productId', deleteProduct);

router.get('/getBaseProducts',getBaseProducts);

router.get('/getBaseProductById/:productId',getBaseProductById);
router.get('/fetchProductsByMerchantId/:merchantId', getProductsByMerchantId);
router.get('/getVariants',getVariants);
router.get('/getCategories',getCategories);



router.post("/upload/image",upload.array("images", 5), handleMulterError,uploadProductImage )
router.delete('/deleteImage/:imageId', deleteImage);

router.post('/addVariant/:productId',upload.array('images'),handleMulterError,addVariant);
router.delete('/deleteVariant/:productId/:variantId', deleteVariant);
router.delete("/deleteSizes/:productId/:variantId/:sizeId", deleteVariantSizes);
router.put("/updateVariant/:productId/:variantId",upload.array("images"),handleMulterError,updateVariant);
router.put("/updateStock/:productId/:variantId/:sizeId", updateSize);
router.put("/updateStock/:productId/:variantId/:sizeId", updateSizeCount);
router.put("/updateStock/:productId/:variantId", updateSize);
router.put("/updatePrice/:productId/:variantId", updatePrice);


router.get('/getOrders',authMiddlewareMerchant,getOrderForMerchant) 

router.put('/products/:id/details', saveProductDetails);

// router.post('/updateOrderStatus',updateOrderStatus);
// router.post('orderPacked',authMiddlewareMerchant,orderPacked)  

router.post('/add',addMerchant)
export default router;
