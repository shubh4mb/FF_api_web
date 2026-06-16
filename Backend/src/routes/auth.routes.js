import express from 'express';
import { sendOTP, verifyOTP, refreshUserToken } from '../controllers/auth.controllers.js';
import { adminLogin, registerAdmin, refreshAdminToken } from '../controllers/adminAuth.controllers.js';
import { googleLogin } from '../controllers/googleAuth.controllers.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication APIs for Users and Admins
 */

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP for login/registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Bad request
 */
router.post('/send-otp', sendOTP);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid OTP
 */
router.post('/verify-otp', verifyOTP);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh User Token
 *     tags: [Auth]
 */
router.post('/refresh', refreshUserToken);

/**
 * @swagger
 * /api/auth/google-login:
 *   post:
 *     summary: Authenticate user via Google Sign-In
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid Google token
 */
router.post('/google-login', googleLogin);

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin logged in
 *       401:
 *         description: Unauthorized
 */
router.post('/admin/login', adminLogin);

/**
 * @swagger
 * /api/auth/admin/register:
 *   post:
 *     summary: Register an admin
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin registered
 *       400:
 *         description: Bad request
 */
router.post('/admin/register', registerAdmin);

/**
 * @swagger
 * /api/auth/admin/refresh:
 *   post:
 *     summary: Refresh Admin Token
 *     tags: [Auth]
 */
router.post('/admin/refresh', refreshAdminToken);

export default router;
