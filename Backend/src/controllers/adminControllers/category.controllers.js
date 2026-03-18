import Category from '../../models/category.model.js';
import { uploadToCloudinary } from '../../config/cloudinary.config.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

// ── Helper: build ancestors object from parent chain ──
async function buildAncestors(parentId, level) {
  const ancestors = {};
  if (!parentId || level == 0) return ancestors;

  const parent = await Category.findById(parentId).lean();
  if (!parent) return ancestors;

  if (level == 1) {
    // Child → parent is root (level 0)
    ancestors.parentName = parent.name;
    ancestors.parentGender = parent.gender || null;
  } else if (level == 2) {
    // Grandchild → parent is level 1, grandparent is level 0
    ancestors.parentName = parent.name;
    ancestors.parentGender = parent.gender || null;

    if (parent.parentId) {
      const grandparent = await Category.findById(parent.parentId).lean();
      if (grandparent) {
        ancestors.grandparentName = grandparent.name;
        ancestors.grandparentGender = grandparent.gender || null;
      }
    }
  }
  return ancestors;
}

export const addCategory = asyncHandler(async (req, res) => {
  let imageDetails = null;
  let logoDetails = null;
  let titleBannersDetails = [];

  const { name, slug, parentId, level, gender, sortOrder, isActive, commissionPercentage } = req.body;

  if (parentId) {
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory) {
      throw new ApiError(400, "Invalid parentId provided");
    }
  }

  // Auto-populate ancestors
  const ancestors = await buildAncestors(parentId, level);

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

    if (req.files.title_banners) {
      for (const file of req.files.title_banners) {
        const detail = await uploadFile([file], 'title_banner');
        if (detail) titleBannersDetails.push(detail);
      }
    }
  }

  if (level == 2 && !imageDetails) {
    throw new ApiError(400, "Image is required for level 2 categories");
  }

  const category = new Category({
    name,
    slug,
    parentId: parentId || null,
    level,
    gender: level == 0 ? (gender || null) : null,
    ancestors,
    sortOrder,
    isActive,
    ...(level == 2 && commissionPercentage !== undefined && { commissionPercentage }),
    ...(imageDetails && { image: imageDetails }),
    ...(logoDetails && { logo: logoDetails }),
    ...(titleBannersDetails.length > 0 && { title_banners: titleBannersDetails })
  });

  await category.save();

  return res.status(201).json(new ApiResponse(201, { category }, "Category added successfully"));
});

export const updateCategory = asyncHandler(async (req, res) => {
  let imageDetails = null;
  let logoDetails = null;
  let titleBannersDetails = [];

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

    if (req.files.title_banners) {
      for (const file of req.files.title_banners) {
        const detail = await uploadFile([file], 'title_banner');
        if (detail) titleBannersDetails.push(detail);
      }
    }
  }

  const updateData = { ...req.body };
  if (imageDetails) updateData.image = imageDetails;
  if (logoDetails) updateData.logo = logoDetails;

  // Retrieve current category to check level for gender logic since level might not be in req.body
  const existingCategoryBeforeUpdate = await Category.findById(req.params.id).lean();
  if (!existingCategoryBeforeUpdate) throw new ApiError(404, "Category not found");
  
  const effectiveCategoryLevel = updateData.level ?? existingCategoryBeforeUpdate.level;

  if (effectiveCategoryLevel > 0) {
    updateData.gender = null; // Only level 0 can have gender
  } else if (updateData.gender === undefined) {
    // Keep existing gender if not provided for level 0
  }

  // Retrieve existing banners that the frontend retained
  let existingTitleBanners = [];
  if (req.body.existing_title_banners) {
    try {
      existingTitleBanners = JSON.parse(req.body.existing_title_banners);
    } catch (err) {
      console.warn("Failed to parse existing_title_banners", err);
    }
  }

  // Clean up frontend body artifacts
  delete updateData.existing_title_banners;

  // Final array is retained banners + newly uploaded banners
  updateData.title_banners = [...existingTitleBanners, ...titleBannersDetails];

  // Re-build ancestors if parentId or level changed
  const existing = await Category.findById(req.params.id).lean();
  if (!existing) throw new ApiError(404, "Category not found");

  const effectiveParentId = updateData.parentId ?? existing.parentId;
  const effectiveLevel = updateData.level ?? existing.level;
  updateData.ancestors = await buildAncestors(effectiveParentId, effectiveLevel);

  const updatedCategory = await Category.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  // Cascade: if name or gender of this category changed, update children's ancestors
  const nameChanged = updateData.name && updateData.name !== existing.name;
  const genderChanged = updateData.gender && updateData.gender !== existing.gender;

  if (nameChanged || genderChanged) {
    const newName = updatedCategory.name;
    const newGender = updatedCategory.gender;

    // Update direct children (level = existing.level + 1)
    if (existing.level === 0) {
      // Root changed → children are level 1
      await Category.updateMany(
        { parentId: updatedCategory._id },
        { $set: { 'ancestors.parentName': newName, 'ancestors.parentGender': newGender } }
      );
      // Grandchildren are level 2 → update grandparent fields
      const childIds = await Category.find({ parentId: updatedCategory._id }).distinct('_id');
      if (childIds.length) {
        await Category.updateMany(
          { parentId: { $in: childIds } },
          { $set: { 'ancestors.grandparentName': newName, 'ancestors.grandparentGender': newGender } }
        );
      }
    } else if (existing.level === 1) {
      // Level-1 changed → grandchildren's parentName
      await Category.updateMany(
        { parentId: updatedCategory._id },
        { $set: { 'ancestors.parentName': newName } }
      );
    }
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



