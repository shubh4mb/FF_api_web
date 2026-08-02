import Warehouse from '../../models/warehouse.model.js';
import Merchant from '../../models/merchant.model.js';
import Product from '../../models/product.model.js';
import { storageService } from '../../services/storage.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

/**
 * POST /admin/warehouse/:warehouseId/products/add
 * Add a product listing to a warehouse.
 * Admin creates these listings — merchants don't self-submit.
 */
export const addWarehouseProduct = asyncHandler(async (req, res) => {
  const { warehouseId } = req.params;
  const {
    sourceProductId,  // optional: link to merchant's original Product
    merchantId, // required: which merchant's consignment is this
    name,
    description,
    brandId,
    categoryId,
    subCategoryId,
    subSubCategoryId,
    gender,
    tags,
    features,
    attributes,
    isTriable,
    commissionRate,
  } = req.body;

  if (!merchantId || !name || !categoryId || !gender) {
    throw new ApiError(400, 'merchantId, name, categoryId, and gender are required');
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || !warehouse.isActive) {
    throw new ApiError(404, 'Warehouse not found or inactive');
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new ApiError(404, 'Merchant not found');

  const warehouseProduct = await Product.create({
    sourceProductId: sourceProductId || null,
    merchantId,
    warehouseId,
    name,
    description,
    brandId,
    categoryId,
    subCategoryId,
    subSubCategoryId,
    gender: Array.isArray(gender) ? gender : [gender],
    tags: tags || [],
    features: features || {},
    attributes: attributes || [],
    isTriable: isTriable ?? true,
    commissionRate: commissionRate ?? null,
    variants: [], // variants added separately via addProductVariant
    addedBy: req.admin?._id || null,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { warehouseProduct }, 'Warehouse product created. Add variants next.'));
});

/**
 * POST /admin/warehouse/products/:warehouseProductId/variants
 * Add a color+size variant (with stock & images) to a warehouse product
 */
export const addWarehouseProductVariant = asyncHandler(async (req, res) => {
  const { warehouseProductId } = req.params;
  const { color, sizes, mrp, price, discount } = req.body;

  let parsedColor, parsedSizes;
  try {
    parsedColor = typeof color === 'string' ? JSON.parse(color) : color;
    parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
  } catch {
    throw new ApiError(400, 'Invalid JSON in color or sizes');
  }

  const safeNum = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };

  // Upload images
  let uploadedImages = [];
  if (req.files && req.files.length > 0) {
    const toUpload = req.files.slice(0, 5);
    uploadedImages = await storageService.uploadMultiple(toUpload, 'warehouse-products');
  }

  const warehouseProduct = await Product.findById(warehouseProductId);
  if (!warehouseProduct) throw new ApiError(404, 'Warehouse product not found');

  const newVariant = {
    color: parsedColor,
    sizes: parsedSizes.map((s) => ({
      size: s.size,
      stock: safeNum(s.stock),
      reservedStock: 0,
    })),
    mrp: safeNum(mrp),
    price: safeNum(price),
    discount: safeNum(discount),
    images: uploadedImages,
  };

  warehouseProduct.variants.push(newVariant);
  await warehouseProduct.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { warehouseProduct }, 'Variant added successfully'));
});

/**
 * GET /admin/warehouse/:warehouseId/products
 * List all products in a warehouse
 */
export const getWarehouseProducts = asyncHandler(async (req, res) => {
  const { warehouseId } = req.params;
  const { isVerified, isActive, gender, page = 1, limit = 20 } = req.query;

  const filter = { warehouseId, isDeleted: false };
  if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (gender) filter.gender = gender;

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('merchantId', 'shopName phoneNumber')
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, { products, total, page: Number(page), limit: Number(limit) }, 'Products retrieved'));
});

/**
 * GET /admin/warehouse/products/:warehouseProductId
 * Get full detail of a single warehouse product
 */
export const getWarehouseProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.warehouseProductId)
    .populate('merchantId', 'shopName phoneNumber email')
    .populate('warehouseId', 'name code address')
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .lean();

  if (!product) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, { product }, 'Product retrieved'));
});

/**
 * PATCH /admin/warehouse/products/:warehouseProductId
 * Update warehouse product metadata or pricing
 */
export const updateWarehouseProduct = asyncHandler(async (req, res) => {
  const allowedFields = [
    'name', 'description', 'brandId', 'categoryId', 'subCategoryId',
    'subSubCategoryId', 'gender', 'tags', 'features', 'attributes',
    'isTriable', 'commissionRate', 'isActive',
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const product = await Product.findByIdAndUpdate(
    req.params.warehouseProductId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!product) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, { product }, 'Product updated'));
});

/**
 * PATCH /admin/warehouse/products/:warehouseProductId/stock
 * Update stock for a specific variant+size
 */
export const updateWarehouseProductStock = asyncHandler(async (req, res) => {
  const { variantId, size, stock } = req.body;

  if (stock === undefined || !variantId || !size) {
    throw new ApiError(400, 'variantId, size, and stock are required');
  }

  const product = await Product.findById(req.params.warehouseProductId);
  if (!product) throw new ApiError(404, 'Warehouse product not found');

  const variant = product.variants.id(variantId);
  if (!variant) throw new ApiError(404, 'Variant not found');

  const sizeObj = variant.sizes.find((s) => s.size === size);
  if (!sizeObj) throw new ApiError(404, 'Size not found in variant');

  sizeObj.stock = Number(stock);
  await product.save();

  return res.status(200).json(new ApiResponse(200, { product }, 'Stock updated'));
});

/**
 * PATCH /admin/warehouse/products/:warehouseProductId/verify
 * Toggle verification status (makes product live/unlive on customer app)
 */
export const toggleWarehouseProductVerification = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.warehouseProductId);
  if (!product) throw new ApiError(404, 'Warehouse product not found');

  product.isVerified = !product.isVerified;
  await product.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { isVerified: product.isVerified }, `Product ${product.isVerified ? 'approved and live' : 'unpublished'}`));
});

/**
 * DELETE /admin/warehouse/products/:warehouseProductId
 * Soft-delete a warehouse product
 */
export const deleteWarehouseProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.warehouseProductId,
    { $set: { isDeleted: true, isActive: false } },
    { new: true }
  );

  if (!product) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, {}, 'Warehouse product removed'));
});
