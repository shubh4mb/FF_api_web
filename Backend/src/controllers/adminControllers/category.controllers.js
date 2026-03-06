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
  let titleBannerDetails = null;

  const { name, slug, parentId, level, gender, sortOrder, isActive } = req.body;

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
    gender: gender || null,
    ancestors,
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



