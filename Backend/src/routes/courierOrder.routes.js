import express from 'express';
import { authMiddleware } from '../middleware/jwtAuth.js';
import {
  initiateCourierOrder,
  initiateCourierCheckout,
  verifyCourierOrderPayment,
  getUserCourierOrders,
  getCourierOrderById,
  getMerchantCourierOrders,
  updateCourierOrderStatus,
  cancelCourierOrder,
} from '../controllers/userControllers/courierOrder.controllers.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Courier Orders
 *   description: Courier-based order APIs (no distance limit, merchant-managed shipping)
 */

// ── User Routes ──

/**
 * @swagger
 * /api/courier/orders/initiate:
 *   post:
 *     summary: Initiate a courier order (creates real Razorpay order)
 *     tags: [Courier Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [merchantId, addressId]
 *             properties:
 *               merchantId: { type: string }
 *               addressId: { type: string }
 *               deliveryTip: { type: number }
 *               couponCode: { type: string }
 *     responses:
 *       200:
 *         description: Order initiated. Razorpay order ID returned.
 */

router.post('/orders/checkout', authMiddleware, initiateCourierCheckout);
router.post('/orders/initiate', authMiddleware, initiateCourierOrder);

/**
 * @swagger
 * /api/courier/orders/verify:
 *   post:
 *     summary: Verify courier order payment (Razorpay signature verification)
 *     tags: [Courier Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *               orderId: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified. Order confirmed.
 */

router.post('/orders/verify', authMiddleware, verifyCourierOrderPayment);

/**
 * @swagger
 * /api/courier/orders:
 *   get:
 *     summary: Get all courier orders for the logged-in user
 *     tags: [Courier Orders]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of courier orders
 */
router.get('/orders', authMiddleware, getUserCourierOrders);

/**
 * @swagger
 * /api/courier/orders/{orderId}:
 *   get:
 *     summary: Get a single courier order by ID
 *     tags: [Courier Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Courier order details
 */
router.get('/orders/:orderId', authMiddleware, getCourierOrderById);

/**
 * @swagger
 * /api/courier/orders/cancel/{orderId}:
 *   post:
 *     summary: Cancel a courier order (user)
 *     tags: [Courier Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order cancelled
 */
router.post('/orders/cancel/:orderId', authMiddleware, cancelCourierOrder);

// ── Merchant Routes ──

/**
 * @swagger
 * /api/courier/orders/merchant/{merchantId}:
 *   get:
 *     summary: Get all courier orders for a merchant
 *     tags: [Courier Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of merchant courier orders
 */
router.get('/orders/merchant/:merchantId', authMiddleware, getMerchantCourierOrders);

/**
 * @swagger
 * /api/courier/orders/{orderId}/status:
 *   patch:
 *     summary: Update courier order status (merchant)
 *     tags: [Courier Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, packed, shipped, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/orders/:orderId/status', authMiddleware, updateCourierOrderStatus);

export default router;
