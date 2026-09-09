import { storageService } from '../../services/storage.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import ProductFlat from '../../models/productFlat.model.js';
import { convertToLegacyFormat } from '../../utils/variantAdapter.js';

/**
 * Helper: Groups flat product docs by styleGroupId and converts each group
 * into the legacy nested product format for response compatibility.
 */
const groupFlatToLegacy = (flatProducts) => {
  const groups = {};
  flatProducts.forEach(p => {
    const key = p.styleGroupId;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  return Object.values(groups).map(siblings => {
    return convertToLegacyFormat(siblings[0], siblings.slice(1));
  }).filter(Boolean);
};

export const getBaseProducts = asyncHandler(async (req, res) => {
  const flatProducts = await ProductFlat.find({ isDeleted: { $ne: true } })
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('merchantId', 'shopName email')
    .sort({ createdAt: -1 });

  const products = groupFlatToLegacy(flatProducts);
  return res.status(200).json(new ApiResponse(200, { products }, "Products retrieved successfully"));
});

export const getVariants = asyncHandler(async (req, res) => {
  const flatProducts = await ProductFlat.find({ isDeleted: { $ne: true } })
    .sort({ createdAt: -1 });
  const products = groupFlatToLegacy(flatProducts);
  return res.status(200).json(new ApiResponse(200, products, "Variants retrieved successfully"));
});

export const getBaseProductById = asyncHandler(async (req, res) => {
  const productId = req.params.productId;
  // Try to find by styleGroupId first, then by _id
  let flatProducts = await ProductFlat.find({ styleGroupId: productId, isDeleted: { $ne: true } })
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('merchantId', 'shopName email');

  if (!flatProducts.length) {
    // Maybe the productId is the _id of a single flat doc
    const singleDoc = await ProductFlat.findById(productId)
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('merchantId', 'shopName email');
    if (singleDoc) {
      flatProducts = await ProductFlat.find({ styleGroupId: singleDoc.styleGroupId, isDeleted: { $ne: true } })
        .populate('brandId', 'name')
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('merchantId', 'shopName email');
    }
  }

  if (!flatProducts.length) {
    throw new ApiError(404, "Product not found");
  }

  const product = convertToLegacyFormat(flatProducts[0], flatProducts.slice(1));
  return res.status(200).json(new ApiResponse(200, product, "Product retrieved"));
});

export const addVariant = asyncHandler(async (req, res) => {
  console.log("Files received:", req.files);

  const productId = req.params.productId;
  const { color, sizes, mrp, price, discount } = req.body;

  let parsedColor, parsedSizes;
  try {
    parsedColor = JSON.parse(color);
    parsedSizes = JSON.parse(sizes);
  } catch (err) {
    throw new ApiError(400, "Invalid JSON in color or sizes");
  }

  const safeNumber = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const safeMrp = safeNumber(mrp);
  const safePrice = safeNumber(price);
  const safeDiscount = safeNumber(discount);

  const MAX_IMAGES = 5;
  const uploadedImages = [];

  if (req.files && req.files.length > 0) {
    const filesToUpload = req.files.slice(0, MAX_IMAGES);
    const results = await storageService.uploadMultiple(filesToUpload, 'products');
    uploadedImages.push(...results);
  }

  const existingFlatProduct = await ProductFlat.findOne({ styleGroupId: productId });
  if (!existingFlatProduct) {
    throw new ApiError(404, "Product group not found");
  }

  const base = existingFlatProduct.toObject();
  delete base._id;
  delete base.__v;
  delete base.createdAt;
  delete base.updatedAt;

  const parentProductCode = existingFlatProduct.productCode.split('-')[0] || existingFlatProduct.productCode;
  const cleanColor = (parsedColor?.name || 'Default').replace(/\s+/g, '').toUpperCase();

  for (const sizeObj of parsedSizes) {
    const cleanSize = sizeObj.size.replace(/\s+/g, '').toUpperCase();
    const flatDoc = new ProductFlat({
      ...base,
      productCode: `${parentProductCode}-${cleanColor}-${cleanSize}`,
      color: parsedColor,
      size: sizeObj.size,
      stock: isNaN(Number(sizeObj.stock)) ? 0 : Number(sizeObj.stock),
      mrp: safeMrp,
      price: safePrice,
      discount: safeDiscount,
      images: uploadedImages
    });
    await flatDoc.save();
  }

  await ProductFlat.deleteOne({
    styleGroupId: productId,
    size: 'Free',
    'color.name': 'Default',
    stock: 0,
    price: 0
  });

  const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
  const legacyProduct = convertToLegacyFormat(siblings[0], siblings.slice(1));

  return res.status(200).json(new ApiResponse(200, { product: legacyProduct }, "Variant added successfully"));
});

export const getFilteredProducts = asyncHandler(async (req, res) => {
  const filter = { isDeleted: { $ne: true } };
  if (req.params.categoryId) filter.categoryId = req.params.categoryId;
  if (req.params.subCategoryId) filter.subCategoryId = req.params.subCategoryId;
  if (req.params.subSubCategoryId) filter.subSubCategoryId = req.params.subSubCategoryId;

  const flatProducts = await ProductFlat.find(filter)
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('merchantId', 'shopName email');

  const products = groupFlatToLegacy(flatProducts);
  return res.status(200).json(new ApiResponse(200, products, "Filtered products retrieved"));
});

export const getProductsByMerchantId = asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const flatProducts = await ProductFlat.find({ merchantId, isDeleted: { $ne: true } })
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('merchantId', 'shopName email');

  const legacyProducts = groupFlatToLegacy(flatProducts);

  const modifiedProducts = legacyProducts.map(product => {
    const mainVariant = product.variants?.[0];
    if (!mainVariant) return null;

    return {
      _id: product._id,
      name: product.name,
      brand: product.brandId,
      merchant: product.merchantId,
      gender: product.gender,
      categoryId: product.categoryId,
      subCategoryId: product.subCategoryId,
      subSubCategoryId: product.subSubCategoryId,
      isActive: product.isActive,
      isVerified: product.isVerified,

      variantId: mainVariant._id,
      price: mainVariant.price,
      mrp: mainVariant.mrp,
      stockSizes: mainVariant.sizes,
      color: mainVariant.color,
      images: mainVariant.images,

      ratings: product.ratings,
      numReviews: product.numReviews,
      discount: mainVariant.discount || 0,

      isMainVariant: true
    };
  }).filter(Boolean);

  return res.status(200).json(new ApiResponse(200, { products: modifiedProducts }, "Merchant products retrieved"));
});

export const updateMatchingProducts = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { matchingProducts } = req.body;

  // Update all siblings in the style group
  const result = await ProductFlat.updateMany(
    { styleGroupId: productId },
    { $set: { matchingProducts } }
  );

  if (result.matchedCount === 0) {
    throw new ApiError(404, "Product not found");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Matching products updated successfully"));
});

export const toggleProductStatus = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Find one sibling to determine current status
  const doc = await ProductFlat.findOne({
    $or: [{ styleGroupId: productId }, { _id: productId }],
    isDeleted: { $ne: true }
  });

  if (!doc) {
    throw new ApiError(404, "Product not found");
  }

  const newStatus = !doc.isActive;

  // Toggle ALL siblings in the same style group
  await ProductFlat.updateMany(
    { styleGroupId: doc.styleGroupId },
    { $set: { isActive: newStatus } }
  );

  return res.status(200).json(new ApiResponse(200, { isActive: newStatus }, "Product status updated successfully"));
});

export const toggleProductVerification = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Find one sibling to determine current status
  const doc = await ProductFlat.findOne({
    $or: [{ styleGroupId: productId }, { _id: productId }],
    isDeleted: { $ne: true }
  });

  if (!doc) {
    throw new ApiError(404, "Product not found");
  }

  const newStatus = !doc.isVerified;

  // Toggle ALL siblings in the same style group
  await ProductFlat.updateMany(
    { styleGroupId: doc.styleGroupId },
    { $set: { isVerified: newStatus } }
  );

  return res.status(200).json(new ApiResponse(200, { isVerified: newStatus }, "Product verification updated successfully"));
});
