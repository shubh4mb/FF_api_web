import express from 'express';
import { register, verifyOTP, savePersonalDetails, uploadDocuments, saveBankDetails, getRider } from '../controllers/deliveryRiderController/auth.controllers.js';
import { authMiddlewareRider } from '../middleware/jwtAuth.js';
import upload from '../middleware/multer.js';
import { handleMulterError } from '../middleware/multer.js';
import {
  acceptOrder,
  reachedPickupLocation,
  verifyOtp,
  reachedCustomerLocation,
  handOutProducts,
  endTrialPhase,
  verifyOtpOnReturn,
  reachedReturnMerchant,
} from '../controllers/deliveryRiderController/orderController.js';
const router = express.Router();

router.post('/register', register);
router.get('/getRiderById', authMiddlewareRider, getRider);
router.post("/auth/verify-otp", verifyOTP);
router.post("/registration/personal-details", authMiddlewareRider, savePersonalDetails);
router.post(
  "/registration/upload-documents",
  authMiddlewareRider,
  upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "licenseFront", maxCount: 1 },
    { name: "licenseBack", maxCount: 1 },
    { name: "panFront", maxCount: 1 },
    { name: "panBack", maxCount: 1 },
  ]),
  handleMulterError,
  uploadDocuments
);
router.post("/registration/bank-details", authMiddlewareRider, saveBankDetails);

// === Order Flow ===
router.post("/order/acceptOrder", authMiddlewareRider, acceptOrder);
router.post("/order/reachedPickupLocation", authMiddlewareRider, reachedPickupLocation);
router.post("/order/verifyOtp", authMiddlewareRider, verifyOtp);                          // pickup OTP
router.post("/order/reachedCustomerLocation", authMiddlewareRider, reachedCustomerLocation);
router.post("/order/handOutProducts", authMiddlewareRider, handOutProducts);               // starts trial
router.post("/order/endTrialPhase", authMiddlewareRider, endTrialPhase);                   // rider ends wait
router.post("/order/returnVerification", authMiddlewareRider, verifyOtpOnReturn);          // return OTP verify
router.post("/order/reachedReturnMerchant", authMiddlewareRider, reachedReturnMerchant);   // ✅ was missing!

export default router;
