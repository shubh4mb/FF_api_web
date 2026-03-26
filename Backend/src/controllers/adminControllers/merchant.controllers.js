import Merchant from "../../models/merchant.model.js";
import { storageService } from "../../services/storage.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";



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
  const merchants = await Merchant.find({ isActive: true })
    .select('shopName phoneNumber email isActive logo rating reviewCount address operatingHours genderCategory zoneName zoneId stats isOnline')
    .lean();
  return res.status(200).json(new ApiResponse(200, { merchants }, "Merchants retrieved successfully"));
});

export const getMerchantById = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.params.id)
    .select('shopName logo backgroundImage rating reviewCount address operatingHours genderCategory zoneName zoneId stats isOnline shopDescription phoneNumber ownerName')
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

  return res.status(200).json(new ApiResponse(200, { merchant }, "Merchant updated successfully"));
});