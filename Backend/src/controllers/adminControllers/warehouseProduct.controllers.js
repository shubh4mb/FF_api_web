import Warehouse from '../../models/warehouse.model.js';
import Merchant from '../../models/merchant.model.js';
import ProductFlat from '../../models/productFlat.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

// Note: Product addition endpoints have been removed as warehouse operators handle this via merchant routes.

/**
 * GET /admin/warehouse/:warehouseId/products
 * List all flat products in a warehouse, grouped by styleGroupId
 */
export const getWarehouseProducts = asyncHandler(async (req, res) => {
  const { warehouseId } = req.params;
  const { isVerified, isActive, gender, page = 1, limit = 20 } = req.query;

  const filter = { warehouseId, source: 'warehouse', isDeleted: false };
  if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (gender) filter.gender = gender;

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline = [
    { $match: filter },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$styleGroupId',
        doc: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
  ];

  const products = await ProductFlat.aggregate(pipeline);
  await ProductFlat.populate(products, [
    { path: 'merchantId', select: 'shopName phoneNumber' },
    { path: 'brandId', select: 'name' },
    { path: 'categoryId', select: 'name' },
    { path: 'subCategoryId', select: 'name' }
  ]);

  const uniqueStyleGroups = await ProductFlat.distinct('styleGroupId', filter);
  const total = uniqueStyleGroups.length;

  return res
    .status(200)
    .json(new ApiResponse(200, { products, total, page: Number(page), limit: Number(limit) }, 'Products retrieved'));
});

/**
 * GET /admin/warehouse/products/:warehouseProductId
 * warehouseProductId is treated as the styleGroupId to fetch all flat variants
 */
export const getWarehouseProductById = asyncHandler(async (req, res) => {
  const styleGroupId = req.params.warehouseProductId;

  const products = await ProductFlat.find({ styleGroupId, source: 'warehouse' })
    .populate('merchantId', 'shopName phoneNumber email')
    .populate('warehouseId', 'name code address')
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .lean();

  if (!products || products.length === 0) throw new ApiError(404, 'Warehouse product not found');

  // Format similarly to how frontend expects
  const baseProduct = products[0];
  const variants = products.map(p => ({
    _id: p._id,
    color: p.color,
    size: p.size,
    merchantSizeCode: p.merchantSizeCode,
    stock: p.stock,
    mrp: p.mrp,
    price: p.price,
    discount: p.discount,
    images: p.images,
    productCode: p.productCode,
  }));

  const product = { ...baseProduct, variants };

  return res.status(200).json(new ApiResponse(200, { product }, 'Product retrieved'));
});

/**
 * PATCH /admin/warehouse/products/:warehouseProductId
 * Update warehouse product metadata across all variants in the styleGroup
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

  const result = await ProductFlat.updateMany(
    { styleGroupId: req.params.warehouseProductId, source: 'warehouse' },
    { $set: updates },
    { runValidators: true }
  );

  if (result.matchedCount === 0) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, { updatedCount: result.modifiedCount }, 'Product updated'));
});

/**
 * PATCH /admin/warehouse/products/:warehouseProductId/stock
 * Update stock for a specific flat variant
 */
export const updateWarehouseProductStock = asyncHandler(async (req, res) => {
  const { variantId, stock } = req.body;

  if (stock === undefined || !variantId) {
    throw new ApiError(400, 'variantId and stock are required');
  }

  const variant = await ProductFlat.findOneAndUpdate(
    { _id: variantId, source: 'warehouse' },
    { $set: { stock: Number(stock) } },
    { new: true }
  );

  if (!variant) throw new ApiError(404, 'Variant not found');

  return res.status(200).json(new ApiResponse(200, { product: variant }, 'Stock updated'));
});

/**
 * PATCH /admin/warehouse/products/:warehouseProductId/verify
 * Toggle verification status across all variants in the styleGroup
 */
export const toggleWarehouseProductVerification = asyncHandler(async (req, res) => {
  const sample = await ProductFlat.findOne({ styleGroupId: req.params.warehouseProductId, source: 'warehouse' });
  if (!sample) throw new ApiError(404, 'Warehouse product not found');

  const newStatus = !sample.isVerified;
  await ProductFlat.updateMany(
    { styleGroupId: req.params.warehouseProductId, source: 'warehouse' },
    { $set: { isVerified: newStatus } }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { isVerified: newStatus }, `Product ${newStatus ? 'approved and live' : 'unpublished'}`));
});

/**
 * DELETE /admin/warehouse/products/:warehouseProductId
 * Soft-delete all variants in the styleGroup
 */
export const deleteWarehouseProduct = asyncHandler(async (req, res) => {
  const result = await ProductFlat.updateMany(
    { styleGroupId: req.params.warehouseProductId, source: 'warehouse' },
    { $set: { isDeleted: true, isActive: false } }
  );

  if (result.matchedCount === 0) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, {}, 'Warehouse product removed'));
});
