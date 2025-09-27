import express from 'express';

import { register, verifyOTP } from '../controllers/deliveryRiderController/auth.controllers.js';

const router=express.Router();

router.post('/register',register);
router.post("/auth/verify-otp", (req, res, next) => {
    console.log("📩 Incoming request to /auth/verify-otp");
    next();
  }, verifyOTP);

export default router;
