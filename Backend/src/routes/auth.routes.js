import express from 'express';
import { sendOTP, verifyOTP } from '../controllers/auth.controllers.js';

const router = express.Router();

router.post('/send-otp', sendOTP);     // POST /api/auth/send-otp
router.post('/verify-otp', verifyOTP); // POST /api/auth/verify-otp

export default router;
