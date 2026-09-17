import express from 'express';
import {
  sendOTP,
  verifyOTP,
  refreshUserToken,
  registerSendOtp,
  registerVerifyOtp,
  emailLogin,
  resendEmailOtp,
  forgotPasswordSendOtp,
  resetPasswordWithOtp,
} from '../controllers/auth.controllers.js';
import { adminLogin, registerAdmin, refreshAdminToken } from '../controllers/adminAuth.controllers.js';
import { googleLogin } from '../controllers/googleAuth.controllers.js';
import { appleLogin } from '../controllers/appleAuth.controllers.js';
import { verifyAdmin } from '../middleware/adminAuth.middleware.js';

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
 * /api/auth/register-send-otp:
 *   post:
 *     summary: Send OTP for email registration
 *     tags: [Auth]
 */
router.post('/register-send-otp', registerSendOtp);

/**
 * @swagger
 * /api/auth/register-verify-otp:
 *   post:
 *     summary: Verify OTP and complete email registration
 *     tags: [Auth]
 */
router.post('/register-verify-otp', registerVerifyOtp);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Email and password login for users
 *     tags: [Auth]
 */
router.post('/login', emailLogin);

/**
 * @swagger
 * /api/auth/resend-email-otp:
 *   post:
 *     summary: Resend OTP for email registration or password reset
 *     tags: [Auth]
 */
router.post('/resend-email-otp', resendEmailOtp);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset OTP to email
 *     tags: [Auth]
 */
router.post('/forgot-password', forgotPasswordSendOtp);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Auth]
 */
router.post('/reset-password', resetPasswordWithOtp);

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
router.post('/apple-login', appleLogin);

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
router.post('/admin/register', verifyAdmin, registerAdmin);

/**
 * @swagger
 * /api/auth/admin/refresh:
 *   post:
 *     summary: Refresh Admin Token
 *     tags: [Auth]
 */
router.post('/admin/refresh', refreshAdminToken);

export default router;
