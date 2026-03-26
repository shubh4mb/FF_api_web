import express from 'express';
import { addCategory, getCategories, updateCategory, getCategoryById } from '../controllers/adminControllers/category.controllers.js';
import { addMerchant, getMerchants, getMerchantById, updateMerchantById } from '../controllers/adminControllers/merchant.controllers.js';
import { addBrand, getBrands } from '../controllers/adminControllers/brand.controllers.js';
import upload, { handleMulterError } from '../middleware/multer.js';
import { getBaseProducts, getVariants, getBaseProductById, addVariant, getProductsByMerchantId, updateMatchingProducts } from '../controllers/adminControllers/product.controllers.js';
import { addTitleBanner } from '../controllers/adminControllers/titleBanner.controllers.js';
import { addCart, getCart } from '../controllers/adminControllers/cart.controllers.js';
import { addZone, getAllZones, checkZoneOverlap } from '../controllers/adminControllers/zone.controllers.js';
import { getAppConfig, updateAppConfig } from '../controllers/adminControllers/appConfig.controllers.js';
import { verifyAdmin } from '../middleware/adminAuth.middleware.js';
import adminBannerRoutes from './adminBanner.routes.js';
import { createAttribute, getAttributes, updateAttribute, deleteAttribute } from '../controllers/adminControllers/attribute.controllers.js';

const router = express.Router();

router.use('/banners', adminBannerRoutes);

router.post('/addCategory', verifyAdmin, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'logo_MEN', maxCount: 1 },
    { name: 'logo_WOMEN', maxCount: 1 },
    { name: 'logo_KIDS', maxCount: 1 },
    { name: 'title_banners', maxCount: 5 }
]), handleMulterError, addCategory);

router.get('/getCategories', getCategories);
router.get('/getCategoryById/:id', getCategoryById);

router.patch('/updateCategory/:id', verifyAdmin, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'logo_MEN', maxCount: 1 },
    { name: 'logo_WOMEN', maxCount: 1 },
    { name: 'logo_KIDS', maxCount: 1 },
    { name: 'title_banners', maxCount: 5 }
]), handleMulterError, updateCategory);


router.post('/addMerchant', verifyAdmin, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'backgroundImage', maxCount: 1 }]), handleMulterError, addMerchant);
router.get('/getMerchants', getMerchants);
router.get('/getMerchant/:id', getMerchantById);
router.patch('/updateMerchant/:id', verifyAdmin, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'backgroundImage', maxCount: 1 }]), handleMulterError, updateMerchantById);


router.post('/brand/add', verifyAdmin, upload.single('logo'), handleMulterError, addBrand);
router.get('/brand/get', verifyAdmin, getBrands);

router.get('/getBaseProducts', getBaseProducts);
router.get('/getVariants', getVariants);
router.get('/getBaseProductById/:productId', getBaseProductById);
router.post('/addVariant/:productId', upload.array('images'), handleMulterError, addVariant);
router.get('/products/merchant/:merchantId', getProductsByMerchantId);
router.put('/updateMatchingProducts/:productId', updateMatchingProducts);

router.post('/titleBanner/add', verifyAdmin, upload.single('image'), handleMulterError, addTitleBanner)

router.post('/cart/add', verifyAdmin, addCart);
router.get('/cart', verifyAdmin, getCart);
// router.put('/cart/updatequantity', verifyAdmin, updateCartQuantity);

router.post('/zone/add', verifyAdmin, addZone);
router.get('/zone', verifyAdmin, getAllZones);
router.post('/zone/check-overlap', verifyAdmin, checkZoneOverlap);

// ── App Config (delivery/return per-km rates) ──
router.get('/config', verifyAdmin, getAppConfig);
router.put('/config', verifyAdmin, updateAppConfig);

// ── Attributes ──
router.post('/attributes', verifyAdmin, createAttribute);
router.get('/attributes', getAttributes);
router.patch('/attributes/:id', verifyAdmin, updateAttribute);
router.delete('/attributes/:id', verifyAdmin, deleteAttribute);

export default router;
