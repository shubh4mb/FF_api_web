import Product from '../../models/product.model.js';
import { storageService } from '../../services/storage.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import ProductFlat from '../../models/productFlat.model.js';
import { convertToLegacyFormat } from '../../utils/variantAdapter.js';


export const getBaseProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({})
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .populate('merchantId', 'name');

  return res.status(200).json(new ApiResponse(200, { products }, "Products retrieved successfully"));
});

export const getVariants = asyncHandler(async (req, res) => {
  const products = await Product.find({});
  return res.status(200).json(new ApiResponse(200, products, "Variants retrieved successfully"));
});

export const getBaseProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId)
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .populate('merchantId', 'name');

  if (!product) {
    throw new ApiError(404, "Product not found");
  }
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

  if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
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
  }

  const newVariant = {
    color: parsedColor,
    sizes: parsedSizes,
    mrp: safeMrp,
    price: safePrice,
    discount: safeDiscount,
    images: uploadedImages,
  };

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    { $push: { variants: newVariant } },
    { new: true, runValidators: true }
  );

  if (!updatedProduct) {
    throw new ApiError(404, "Product not found");
  }

  return res.status(200).json(new ApiResponse(200, { product: updatedProduct }, "Variant added successfully"));
});

export const getFilteredProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    categoryId: req.params.categoryId,
    subCategoryId: req.params.subCategoryId,
    subSubCategoryId: req.params.subSubCategoryId,
  })
    .populate('brandId', 'name')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('subSubCategoryId', 'name')
    .populate('merchantId', 'name');

  return res.status(200).json(new ApiResponse(200, products, "Filtered products retrieved"));
});


export const getProductsByMerchantId = asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const products = await Product.find({ merchantId: merchantId }).populate([
    { path: 'brandId', select: 'name' },
    { path: 'categoryId', select: 'name' },
    { path: 'subCategoryId', select: 'name' },
    { path: 'subSubCategoryId', select: 'name' },
  ]);

  const modifiedProducts = products.map(product => {
    const mainVariant = product.variants[0]; // only the first variant
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

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  product.matchingProducts = matchingProducts;
  await product.save();

  return res.status(200).json(new ApiResponse(200, {}, "Matching products updated successfully"));
});

export const toggleProductStatus = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findById(productId);
  
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  product.isActive = !product.isActive;
  await product.save();

  return res.status(200).json(new ApiResponse(200, { isActive: product.isActive }, "Product status updated successfully"));
});

export const toggleProductVerification = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findById(productId);
  
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  product.isVerified = !product.isVerified;
  await product.save();

  return res.status(200).json(new ApiResponse(200, { isVerified: product.isVerified }, "Product verification updated successfully"));
});
