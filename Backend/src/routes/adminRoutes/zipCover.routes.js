import express from 'express';
import { getAllZipCoverOrders, updateZipCoverOrderStatus } from '../../controllers/adminController/zipCoverController.js';

const router = express.Router();

router.get('/', getAllZipCoverOrders);
router.patch('/:id/status', updateZipCoverOrderStatus);

export default router;
