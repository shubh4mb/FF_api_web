import express from 'express';
import { createZipCoverOrder, getMyZipCoverOrders } from '../../controllers/merchantController/zipCoverController.js';
import { authMiddlewareMerchant } from '../../middleware/jwtAuth.js';

const router = express.Router();

router.use(authMiddlewareMerchant); // Ensure merchant is authenticated

router.post('/order', createZipCoverOrder);
router.get('/', getMyZipCoverOrders);

export default router;
