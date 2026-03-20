import Merchant from "../../models/merchant.model.js";
import { uploadToCloudinary } from "../../config/cloudinary.config.js";
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

  let imageDetails = null; // ✅ Declare outside try block
  let bgImageDetails = null;

  try {
    const logoFile = req.files['logo'][0];
    const imageResult = await uploadToCloudinary(logoFile.buffer, {
      folder: 'merchant/logo',
      resource_type: 'auto'
    });

    imageDetails = {
      public_id: imageResult.public_id,
      url: imageResult.secure_url
    };

    if (req.files['backgroundImage']) {
      const bgFile = req.files['backgroundImage'][0];
      const bgResult = await uploadToCloudinary(bgFile.buffer, {
        folder: 'merchant/background',
        resource_type: 'auto'
      });
      bgImageDetails = {
        public_id: bgResult.public_id,
        url: bgResult.secure_url
      };
    }
  } catch (uploadError) {
    console.log(uploadError);
    throw new ApiError(500, "Error uploading image to Cloudinary", [uploadError.message]);
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
    try {
      const imageResult = await uploadToCloudinary(req.files['logo'][0].buffer, {
        folder: 'merchant/logo',
        resource_type: 'auto'
      });

      imageDetails = {
        public_id: imageResult.public_id,
        url: imageResult.secure_url
      };
      req.body.logo = imageDetails;
    } catch (uploadError) {
      throw new ApiError(500, "Error uploading logo to Cloudinary", [uploadError.message]);
    }
  }

  if (req.files && req.files['backgroundImage']) {
    try {
      const bgResult = await uploadToCloudinary(req.files['backgroundImage'][0].buffer, {
        folder: 'merchant/background',
        resource_type: 'auto'
      });

      bgImageDetails = {
        public_id: bgResult.public_id,
        url: bgResult.secure_url
      };
      req.body.backgroundImage = bgImageDetails;
    } catch (uploadError) {
      throw new ApiError(500, "Error uploading background image to Cloudinary", [uploadError.message]);
    }
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