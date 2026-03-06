import express from 'express';
import { sendOTP, verifyOTP } from '../controllers/auth.controllers.js';
import { adminLogin, registerAdmin } from '../controllers/adminAuth.controllers.js';

const router = express.Router();

router.post('/send-otp', sendOTP);     // POST /api/auth/send-otp
router.post('/verify-otp', verifyOTP); // POST /api/auth/verify-otp

router.post('/admin/login', adminLogin); // POST /api/auth/admin/login
router.post('/admin/register', registerAdmin);   // POST /api/auth/admin/register

export default router;
