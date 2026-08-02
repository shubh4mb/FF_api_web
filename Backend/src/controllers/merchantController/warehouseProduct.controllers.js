import Product from '../../models/product.model.js';
import Warehouse from '../../models/warehouse.model.js';
import Merchant from '../../models/merchant.model.js';
import Category from '../../models/category.model.js';
import Brand from '../../models/brand.model.js';
import { storageService } from '../../services/storage.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

/**
 * GET /merchant/warehouse-products
 * List all products for the logged-in operator's warehouse.
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
    .json(new ApiResponse(200, { products, total, page: Number(page), limit: Number(limit) }, 'Warehouse products retrieved'));
});

/**
 * POST /merchant/warehouse-products/add
 * Add a new product listing to the operator's warehouse.
 */
export const addMyWarehouseProduct = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator or no warehouse linked');
  }

  const {
    sourceProductId,
    merchantId,
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

  const sourceMerchant = await Merchant.findById(merchantId);
  if (!sourceMerchant) throw new ApiError(404, 'Source Merchant not found');

  const warehouseProduct = await Product.create({
    sourceProductId: sourceProductId || null,
    merchantId: merchantId,
    source: 'warehouse',
    warehouseId: merchant.warehouseId,
    name,
    description,
    brandId,
    categoryId,
    subCategoryId,
    subSubCategoryId,
    gender: (Array.isArray(gender) ? gender : [gender]).map(g => String(g).toUpperCase()),
    tags: tags || [],
    features: features || {},
    attributes: attributes || [],
    isTriable: isTriable ?? true,
    commissionRate: commissionRate ?? null,
    variants: [],
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { warehouseProduct }, 'Warehouse product created. Add variants next.'));
});

/**
 * POST /merchant/warehouse-products/:warehouseProductId/variants
 * Add a variant to a product in the operator's warehouse.
 */
export const addMyWarehouseProductVariant = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

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

  let uploadedImages = [];
  if (req.files && req.files.length > 0) {
    uploadedImages = await storageService.uploadMultiple(req.files, 'warehouse-products');
  }

  const warehouseProduct = await Product.findOne({
    _id: warehouseProductId,
    warehouseId: merchant.warehouseId,
  });
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
 * PATCH /merchant/warehouse-products/:warehouseProductId
 * Update product details for the operator's warehouse.
 */
export const updateMyWarehouseProduct = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  const { warehouseProductId } = req.params;
  const allowedFields = [
    'name', 'description', 'brandId', 'categoryId', 'merchantId', 'subCategoryId',
    'subSubCategoryId', 'gender', 'tags', 'features', 'attributes',
    'isTriable', 'commissionRate'
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const product = await Product.findOneAndUpdate(
    { _id: warehouseProductId, warehouseId: merchant.warehouseId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!product) throw new ApiError(404, 'Warehouse product not found');

  return res.status(200).json(new ApiResponse(200, { product }, 'Product updated successfully'));
});

/**
 * PATCH /merchant/warehouse-products/:warehouseProductId/stock
 * Update stock of a product variant size in the operator's warehouse.
 */
export const updateMyWarehouseProductStock = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  const { warehouseProductId } = req.params;
  const { variantId, size, stock } = req.body;

  if (!variantId || !size || stock === undefined) {
    throw new ApiError(400, 'variantId, size, and stock are required');
  }

  const product = await Product.findOne({
    _id: warehouseProductId,
    warehouseId: merchant.warehouseId,
  });
  if (!product) throw new ApiError(404, 'Warehouse product not found');

  const variant = product.variants.id(variantId);
  if (!variant) throw new ApiError(404, 'Variant not found');

  const sizeObj = variant.sizes.find((s) => s.size === size);
  if (!sizeObj) {
    variant.sizes.push({ size, stock: Number(stock), reservedStock: 0 });
  } else {
    sizeObj.stock = Number(stock);
  }

  await product.save();
  return res.status(200).json(new ApiResponse(200, { product }, 'Stock updated successfully'));
});

/**
 * DELETE /merchant/warehouse-products/:warehouseProductId
 * Delete product from the operator's warehouse.
 */
export const deleteMyWarehouseProduct = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== 'warehouse' || !merchant.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  const product = await Product.findOneAndUpdate(
    { _id: req.params.warehouseProductId, warehouseId: merchant.warehouseId },
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!product) throw new ApiError(404, 'Warehouse product not found');
  return res.status(200).json(new ApiResponse(200, {}, 'Product deleted successfully'));
});

/**
 * POST /merchant/warehouse-products/full
 * Create a full warehouse product with variants and images in one go (like the detailed merchant UI).
 */
export const createWarehouseProductFull = asyncHandler(async (req, res) => {
  const operator = await Merchant.findById(req.merchantId);
  if (!operator || operator.accountType !== 'warehouse' || !operator.warehouseId) {
    throw new ApiError(403, 'Not a warehouse operator');
  }

  let { 
    merchantId, commissionRate, name, description, styleName, categoryId, subCategoryId, gender, 
    attributes, tags, collectionIds, variants 
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

  const legacyVariants = [];
  for (let vIdx = 0; vIdx < variants.length; vIdx++) {
    const variant = variants[vIdx];
    const finalImages = [];
    if (variant.imageFields && Array.isArray(variant.imageFields)) {
      for (const field of variant.imageFields) {
        const file = req.files ? req.files.find(f => f.fieldname === field) : null;
        if (file) {
          const uploadRes = await storageService.uploadSingle(file, "warehouse-products");
          if (uploadRes) finalImages.push(uploadRes);
        }
      }
    }

    const sizeStockList = (variant.sizes || []).map(s => ({
      size: s.size,
      stock: isNaN(Number(s.stock)) ? 0 : Number(s.stock),
      reservedStock: 0
    }));

    legacyVariants.push({
      color: variant.color,
      mrp: isNaN(Number(variant.mrp)) ? 0 : Number(variant.mrp),
      price: isNaN(Number(variant.price)) ? 0 : Number(variant.price),
      discount: isNaN(Number(variant.discount)) ? 0 : Number(variant.discount),
      images: finalImages,
      sizes: sizeStockList,
    });
  }

  const formattedGender = (Array.isArray(gender) ? gender : [gender]).map(g => String(g).toUpperCase());

  const newProduct = new Product({
    name,
    description,
    styleName,
    categoryId,
    subCategoryId,
    brandId,
    merchantId: sourceMerchant._id,
    source: 'warehouse',
    warehouseId: operator.warehouseId,
    commissionRate: commissionRate ? parseFloat(commissionRate) : null,
    gender: formattedGender,
    attributes,
    tags,
    collectionIds,
    isTriable: req.body.isTriable === 'true' || req.body.isTriable === true,
    isActive: true,
    variants: legacyVariants,
  });

  await newProduct.save();

  return res.status(201).json(new ApiResponse(201, { product: newProduct }, 'Warehouse product created with variants successfully'));
});

/**
 * GET /merchant/my-consigned-stock
 * Fetch all products owned by the logged-in merchant that are currently stored in FlashFits warehouses.
 */
export const getMyConsignedWarehouseStock = asyncHandler(async (req, res) => {
  const merchantId = req.merchantId;
  const products = await Product.find({
    merchantId,
    source: 'warehouse',
    isDeleted: { $ne: true }
  })
    .populate('warehouseId', 'name address code')
    .populate('categoryId', 'name')
    .populate('brandId', 'name')
    .sort({ createdAt: -1 });

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
