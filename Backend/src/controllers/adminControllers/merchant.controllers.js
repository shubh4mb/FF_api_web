import Merchant from "../../models/merchant.model.js";
import Zone from "../../models/zone.model.js";
import { storageService } from "../../services/storage.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { sendVerificationEmail } from "../../services/mail.service.js";



export const addMerchant = asyncHandler(async (req, res) => {
  console.log("hiii");
  
  // Sanitize genderCategory: handle array or comma-separated string
  if (req.body.genderCategory) {
    if (typeof req.body.genderCategory === 'string') {
      req.body.genderCategory = req.body.genderCategory.split(',').map(item => item.trim());
    } else if (!Array.isArray(req.body.genderCategory)) {
      req.body.genderCategory = [req.body.genderCategory];
    }
  }

  const merchant = new Merchant(req.body);
  
  if (req.body.zoneId) {
    const zone = await Zone.findById(req.body.zoneId).lean();
    if (zone) {
      merchant.isZoneLive = zone.status === 'Active';
    }
  }
  if (!req.files || !req.files['logo']) {
    throw new ApiError(400, "Logo is required");
  }

  const imageDetails = await storageService.uploadSingle(req.files['logo'], 'merchant/logo');
  let bgImageDetails = null;

  if (req.files['backgroundImage']) {
    bgImageDetails = await storageService.uploadSingle(req.files['backgroundImage'], 'merchant/background');
  }

  merchant.logo = imageDetails;
  if (bgImageDetails) merchant.backgroundImage = bgImageDetails;
  await merchant.save();
  return res.status(201).json(new ApiResponse(201, { merchant }, "Merchant created successfully"));
});

export const getMerchants = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = status ? { status } : {};

  const merchants = await Merchant.find(query)
    .select('shopName phoneNumber email isActive status logo rating reviewCount address operatingHours genderCategory zoneName zoneId stats isOnline isVerified')
    .lean();
  return res.status(200).json(new ApiResponse(200, { merchants }, "Merchants retrieved successfully"));
});

export const getMerchantById = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.params.id)
    .lean();
  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }
  return res.status(200).json(new ApiResponse(200, { merchant }, "Merchant retrieved successfully"));
});

export const updateMerchantById = asyncHandler(async (req, res) => {
  let imageDetails = null;
  let bgImageDetails = null;

  if (req.files && req.files['logo']) {
    const imageDetails = await storageService.uploadSingle(req.files['logo'], 'merchant/logo');
    if (imageDetails) req.body.logo = imageDetails;
  }

  if (req.files && req.files['backgroundImage']) {
    const bgImageDetails = await storageService.uploadSingle(req.files['backgroundImage'], 'merchant/background');
    if (bgImageDetails) req.body.backgroundImage = bgImageDetails;
  }

  // Sanitize genderCategory: handle array or comma-separated string
  if (req.body.genderCategory) {
    if (typeof req.body.genderCategory === 'string') {
      req.body.genderCategory = req.body.genderCategory.split(',').map(item => item.trim());
    } else if (!Array.isArray(req.body.genderCategory)) {
      req.body.genderCategory = [req.body.genderCategory];
    }
  }

  const merchant = await Merchant.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }

  // If zone changed, sync the isZoneLive status
  if (req.body.zoneId) {
    const zone = await Zone.findById(req.body.zoneId).lean();
    if (zone) {
      merchant.isZoneLive = zone.status === 'Active';
      await merchant.save();
    }
  }

  return res.status(200).json(new ApiResponse(200, { merchant }, "Merchant updated successfully"));
});

export const verifyMerchant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isVerified, kycVerifications } = req.body;

  let updateQuery = {};
  if (isVerified !== undefined) {
    updateQuery.isVerified = !!isVerified;
    if (!!isVerified) {
      updateQuery.status = 'pending_payment';
    } else {
      updateQuery.status = 'rejected';
    }
  }

  if (kycVerifications) {
    if (kycVerifications.pan !== undefined) updateQuery['kyc.pan.verified'] = !!kycVerifications.pan;
    if (kycVerifications.gst !== undefined) updateQuery['kyc.gst.verified'] = !!kycVerifications.gst;
    if (kycVerifications.businessProof !== undefined) updateQuery['kyc.businessProof.verified'] = !!kycVerifications.businessProof;
    if (kycVerifications.bankProof !== undefined) updateQuery['kyc.bankProof.verified'] = !!kycVerifications.bankProof;
    if (kycVerifications.bankDetails !== undefined) updateQuery['bankDetails.isBankVerified'] = !!kycVerifications.bankDetails;
  }

  const merchant = await Merchant.findByIdAndUpdate(
    id,
    { $set: updateQuery },
    { new: true }
  );

  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }

  // Trigger email notification if verified
  if (isVerified) {
    try {
      await sendVerificationEmail(merchant.email, merchant.shopName);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // We don't throw here to avoid failing the verification itself
    }
  }

  return res.status(200).json(
    new ApiResponse(200, { merchant }, `Merchant ${isVerified ? "verified" : "unverified"} successfully`)
  );
});