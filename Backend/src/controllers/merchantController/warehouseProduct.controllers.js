import ProductFlat from '../../models/productFlat.model.js';
import Warehouse from '../../models/warehouse.model.js';
import Merchant from '../../models/merchant.model.js';
import Brand from '../../models/brand.model.js';
import { storageService } from '../../services/storage.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Helper to group flat variants for the response
 */
const makeFlatPayload = (siblings, extraData = {}) => {
  if (!siblings || !siblings.length) return null;
  const activeProduct = siblings[0];
  const otherSiblings = siblings.slice(1);
  return {
    isFlatPayload: true,
    activeProduct,
    siblings: otherSiblings,
    ...extraData
  };
};

/**
 * GET /merchant/warehouse-products
 * List all products for the logged-in operator's warehouse, grouped by styleGroupId.
 */
export const getMyWarehouseProducts = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator or no warehouse linked');
  }

  const { isVerified, isActive, gender, page = 1, limit = 50 } = req.query;
  const filter = { warehouseId: merchant.warehouseId, source: 'warehouse', isDeleted: { $ne: true } };
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
    .json(new ApiResponse(200, { products, total, page: Number(page), limit: Number(limit) }, 'Warehouse products retrieved'));
});

/**
 * POST /merchant/warehouse-products/full
 * Create a full warehouse product with variants and images in one go (like the detailed merchant UI).
 * Generates ProductFlat documents.
 */
export const createWarehouseProductFull = asyncHandler(async (req, res) => {
  const operator = await Merchant.findById(req.merchantId);
  if (!operator || operator.accountType !== 'warehouse' || !operator.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  let { 
    merchantId, commissionRate, name, description, styleName, categoryId, subCategoryId, gender, 
    attributes, tags, collectionIds, variants, linkedMerchantProductId 
  } = req.body;

  const safeParse = (value) => {
    if (!value) return value;
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  };

  gender = safeParse(gender) || [];
  attributes = safeParse(attributes) || [];
  tags = safeParse(tags) || [];
  collectionIds = safeParse(collectionIds) || [];
  variants = safeParse(variants) || [];

  const cleanAttributes = (Array.isArray(attributes) ? attributes : [])
    .map(a => {
      let rawId = a.attributeId || a.attribute;
      if (rawId && typeof rawId === 'object') {
        rawId = rawId._id || rawId.id;
      }
      if (!rawId) return null;
      return {
        attributeId: mongoose.Types.ObjectId.isValid(String(rawId))
          ? new mongoose.Types.ObjectId(String(rawId))
          : String(rawId),
        value: a.value
      };
    })
    .filter(Boolean);

  if (!name || !categoryId || !merchantId || !variants.length) {
    throw new ApiError(400, 'name, categoryId, merchantId (source merchant), and variants are required');
  }

  const sourceMerchant = await Merchant.findById(merchantId);
  if (!sourceMerchant) throw new ApiError(404, 'Source Merchant not found');

  // Resolve or auto-create brand for the source merchant (optional)
  let brandId = req.body.brandId || undefined;
  if (!brandId) {
    try {
      const brandName = sourceMerchant.shopName || sourceMerchant.ownerName || "Default Brand";
      let brand = await Brand.findOne({ name: brandName, createdById: sourceMerchant._id });
      if (!brand && sourceMerchant.brandId) {
        brand = await Brand.findById(sourceMerchant.brandId);
      }
      if (!brand) {
        brand = await Brand.create({
          name: brandName,
          createdByType: 'Merchant',
          createdById: sourceMerchant._id,
        });
      }
      if (brand) brandId = brand._id;
    } catch (brandErr) {
      console.error("Optional brand resolution failed:", brandErr);
    }
  }

  const generatedGroupId = new mongoose.Types.ObjectId().toString();
  const parentProductCode = `PRD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const formattedGender = (Array.isArray(gender) ? gender : [gender]).map(g => String(g).toUpperCase());
  
  const createdProducts = [];

  for (let vIdx = 0; vIdx < variants.length; vIdx++) {
    const variant = variants[vIdx];
    const finalImages = [];

    const pushNormalizedImage = (img) => {
      if (!img) return;
      if (typeof img === 'string') {
        finalImages.push({ url: img, public_id: '' });
      } else if (img.url) {
        finalImages.push({ url: img.url, public_id: img.public_id || '' });
      }
    };

    if (variant.existingImages && Array.isArray(variant.existingImages)) {
      variant.existingImages.forEach(pushNormalizedImage);
    } else if (variant.images && Array.isArray(variant.images)) {
      variant.images.forEach(pushNormalizedImage);
    }

    if (variant.imageFields && Array.isArray(variant.imageFields)) {
      for (const field of variant.imageFields) {
        const file = req.files ? req.files.find(f => f.fieldname === field) : null;
        if (file) {
          const uploadRes = await storageService.uploadSingle(file, "warehouse-products");
          if (uploadRes) finalImages.push(uploadRes);
        }
      }
    }

    const sizes = variant.sizes || [];
    const colorObj = variant.color || { name: 'Default', hex: '' };

    for (const sizeObj of sizes) {
      const cleanColor = (colorObj.name || 'DEFAULT').replace(/\s+/g, '').toUpperCase();
      const cleanSize = (sizeObj.size || 'FREE').replace(/\s+/g, '').toUpperCase();
      const productCode = `${parentProductCode}-${cleanColor}-${cleanSize}`;

      const newProduct = new ProductFlat({
        name,
        description,
        styleName,
        categoryId,
        subCategoryId,
        brandId,
        merchantId: sourceMerchant._id,
        source: 'warehouse',
        warehouseId: operator.warehouseId,
        addedByOperator: operator._id,
        commissionRate: commissionRate ? parseFloat(commissionRate) : null,
        linkedMerchantProductId: linkedMerchantProductId || req.body.selectedBaseProductId || null,
        gender: formattedGender,
        attributes: cleanAttributes,
        tags,
        collectionIds,
        isTriable: req.body.isTriable === 'true' || req.body.isTriable === true,
        isActive: true,
        
        styleGroupId: generatedGroupId,
        productCode: productCode,
        color: colorObj,
        size: sizeObj.size,
        merchantSizeCode: sizeObj.merchantSizeCode,
        stock: isNaN(Number(sizeObj.stock)) ? 0 : Number(sizeObj.stock),
        mrp: isNaN(Number(variant.mrp)) ? 0 : Number(variant.mrp),
        price: isNaN(Number(variant.price)) ? 0 : Number(variant.price),
        discount: isNaN(Number(variant.discount)) ? 0 : Number(variant.discount),
        images: finalImages
      });

      await newProduct.save();
      createdProducts.push(newProduct);
    }
  }

  return res.status(201).json(new ApiResponse(201, { product: makeFlatPayload(createdProducts) }, 'Warehouse product created successfully'));
});

/**
 * PATCH /merchant/warehouse-products/:warehouseProductId
 * Update product details for the operator's warehouse across the styleGroupId
 */
export const updateMyWarehouseProduct = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  const { warehouseProductId } = req.params; // styleGroupId
  const allowedFields = [
    'name', 'description', 'brandId', 'categoryId', 'merchantId', 'subCategoryId',
    'subSubCategoryId', 'gender', 'tags', 'features', 'attributes',
    'isTriable', 'commissionRate'
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const result = await ProductFlat.updateMany(
    { styleGroupId: warehouseProductId, warehouseId: merchant.warehouseId, source: 'warehouse' },
    { $set: updates },
    { runValidators: true }
  );

  if (result.matchedCount === 0) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, { updatedCount: result.modifiedCount }, 'Product updated successfully'));
});

/**
 * PATCH /merchant/warehouse-products/:warehouseProductId/stock
 * Update stock of a product flat document
 */
export const updateMyWarehouseProductStock = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  const { warehouseProductId } = req.params; // Not really needed for flat if we have variantId, but we can use it to verify
  const { variantId, stock } = req.body;

  if (!variantId || stock === undefined) {
    throw new ApiError(400, 'variantId and stock are required');
  }

  const product = await ProductFlat.findOneAndUpdate(
    { _id: variantId, warehouseId: merchant.warehouseId, source: 'warehouse' },
    { $set: { stock: Number(stock) } },
    { new: true }
  );

  if (!product) throw new ApiError(404, 'Warehouse variant not found');

  return res.status(200).json(new ApiResponse(200, { product }, 'Stock updated successfully'));
});

/**
 * DELETE /merchant/warehouse-products/:warehouseProductId
 * Soft-delete product from the operator's warehouse (across styleGroupId).
 */
export const deleteMyWarehouseProduct = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  const result = await ProductFlat.updateMany(
    { styleGroupId: req.params.warehouseProductId, warehouseId: merchant.warehouseId, source: 'warehouse' },
    { $set: { isDeleted: true } }
  );

  if (result.matchedCount === 0) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, {}, 'Product deleted successfully'));
});

/**
 * GET /merchant/my-consigned-stock
 * Fetch all products owned by the logged-in merchant that are currently stored in FlashFits warehouses.
 */
export const getMyConsignedWarehouseStock = asyncHandler(async (req, res) => {
  const merchantId = req.merchantId;
  
  const pipeline = [
    { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), source: 'warehouse', isDeleted: { $ne: true } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$styleGroupId',
        doc: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { createdAt: -1 } }
  ];

  const products = await ProductFlat.aggregate(pipeline);
  await ProductFlat.populate(products, [
    { path: 'warehouseId', select: 'name address code' },
    { path: 'categoryId', select: 'name' },
    { path: 'brandId', select: 'name' }
  ]);

  const merchant = await Merchant.findById(merchantId).select('warehouseStatus');

  return res.status(200).json(new ApiResponse(200, {
    warehouseStatus: merchant?.warehouseStatus || 'none',
    products
  }, 'Consigned warehouse stock retrieved successfully'));
});

/**
 * POST /merchant/apply-warehouse
 * Merchant submits an application to opt-in for FlashFits warehouse fulfillment service.
 */
export const applyForWarehouseService = asyncHandler(async (req, res) => {
  const merchantId = req.merchantId;
  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new ApiError(404, 'Merchant not found');

  if (merchant.warehouseStatus === 'approved') {
    return res.status(200).json(new ApiResponse(200, { warehouseStatus: 'approved' }, 'Already approved for warehouse service'));
  }

  merchant.warehouseStatus = 'pending';
  await merchant.save();

  return res.status(200).json(new ApiResponse(200, { warehouseStatus: 'pending' }, 'Application submitted successfully. Under review by Admin.'));
});

// Polyfill for deprecated endpoints that some frontend might still call
export const addMyWarehouseProduct = asyncHandler(async (req, res) => {
  throw new ApiError(400, 'Deprecated. Use /warehouse-products/full instead.');
});

export const addMyWarehouseProductVariant = asyncHandler(async (req, res) => {
  throw new ApiError(400, 'Deprecated. Use /warehouse-products/full instead.');
});
