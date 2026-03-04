import Category from '../../models/category.model.js';
import { uploadToCloudinary } from '../../config/cloudinary.config.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export const addCategory = asyncHandler(async (req, res) => {
  console.log("yes reaching controller : ", req.body)
  console.log(req.files, "files --")

  let imageDetails = null;
  let logoDetails = null;
  let titleBannerDetails = null;

  const { name, slug, parentId, level, gender, sortOrder, isActive } = req.body;

  if (parentId) {
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory) {
      throw new ApiError(400, "Invalid parentId provided");
    }
  }

  const uploadFile = async (fileObj, folderName) => {
    if (!fileObj || !fileObj[0]) return null;
    try {
      const imageResult = await uploadToCloudinary(fileObj[0].buffer, {
        folder: `category/${folderName}`,
        resource_type: 'auto'
      });
      return {
        public_id: imageResult.public_id,
        url: imageResult.secure_url
      };
    } catch (uploadError) {
      throw new Error('Error uploading ' + folderName + ' to Cloudinary: ' + uploadError.message);
    }
  };

  if (req.files) {
    imageDetails = await uploadFile(req.files.image, 'image');
    logoDetails = await uploadFile(req.files.logo, 'logo');
    titleBannerDetails = await uploadFile(req.files.title_banner, 'title_banner');
  }

  if (level == 2 && !imageDetails) {
    throw new ApiError(400, "Image is required for level 2 categories");
  }

  const category = new Category({
    name,
    slug,
    parentId: parentId || null,
    level,
    gender,
    sortOrder,
    isActive,
    ...(imageDetails && { image: imageDetails }),
    ...(logoDetails && { logo: logoDetails }),
    ...(titleBannerDetails && { title_banner: titleBannerDetails })
  });

  await category.save();

  return res.status(201).json(new ApiResponse(201, { category }, "Category added successfully"));
});

export const updateCategory = asyncHandler(async (req, res) => {
  let imageDetails = null;
  let logoDetails = null;
  let titleBannerDetails = null;

  const uploadFile = async (fileObj, folderName) => {
    if (!fileObj || !fileObj[0]) return null;
    const imageResult = await uploadToCloudinary(fileObj[0].buffer, {
      folder: `category/${folderName}`,
      resource_type: 'auto'
    });
    return {
      public_id: imageResult.public_id,
      url: imageResult.secure_url
    };
  };

  if (req.files) {
    imageDetails = await uploadFile(req.files.image, 'image');
    logoDetails = await uploadFile(req.files.logo, 'logo');
    titleBannerDetails = await uploadFile(req.files.title_banner, 'title_banner');
  }

  const updateData = { ...req.body };
  if (imageDetails) updateData.image = imageDetails;
  if (logoDetails) updateData.logo = logoDetails;
  if (titleBannerDetails) updateData.title_banner = titleBannerDetails;

  const updatedCategory = await Category.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  if (!updatedCategory) {
    throw new ApiError(404, "Category not found");
  }

  return res.status(200).json(new ApiResponse(200, { updatedCategory }, "Category updated successfully"));
});

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true });
  return res.status(200).json(new ApiResponse(200, { categories }, "Categories retrieved"));
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new ApiError(404, "Category not found");
  }
  return res.status(200).json(new ApiResponse(200, { category }, "Category retrieved"));
});



