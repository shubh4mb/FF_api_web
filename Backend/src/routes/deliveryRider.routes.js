import express from 'express';

import { register, verifyOTP, savePersonalDetails ,uploadDocuments,saveBankDetails} from '../controllers/deliveryRiderController/auth.controllers.js';
import { authMiddlewareRider } from '../middleware/jwtAuth.js';
import upload from '../middleware/multer.js';
import { handleMulterError } from '../middleware/multer.js';
import { acceptOrder ,reachedPickupLocation , verifyOtp,reachedCustomerLocation,handOutProducts,endTrialPhase,verifyOtpOnReturn} from '../controllers/deliveryRiderController/orderController.js';
const router=express.Router();

router.post('/register',register);
router.post("/auth/verify-otp", (req, res, next) => {
    console.log("📩 Incoming request to /auth/verify-otp");
    next();
  }, verifyOTP);
router.post("/registration/personal-details",authMiddlewareRider, savePersonalDetails);
// router.post("/registration/upload-documents",authMiddlewareRider,upload.array("documents", 6), uploadDocuments);
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
  handleMulterError, // optional error handler
  uploadDocuments
);

router.post("/registration/bank-details", authMiddlewareRider, saveBankDetails);
router.post("/order/acceptOrder",authMiddlewareRider,acceptOrder);
router.post("/order/reachedPickupLocation",authMiddlewareRider,reachedPickupLocation);
router.post("/order/verifyOtp",authMiddlewareRider,verifyOtp);
router.post("/order/reachedCustomerLocation",authMiddlewareRider,reachedCustomerLocation);
router.post("/order/handOutProducts",authMiddlewareRider,handOutProducts);
router.post("/order/endTrialPhase",authMiddlewareRider,endTrialPhase);
router.post("/order/returnVerification",authMiddlewareRider,verifyOtpOnReturn);



export default router;
