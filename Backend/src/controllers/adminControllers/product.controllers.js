import Product from '../../models/product.model.js';
import { storageService } from '../../services/storage.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';


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

  // Parse JSON strings safely
  let parsedColor, parsedSizes;
  try {
    parsedColor = JSON.parse(color);
    parsedSizes = JSON.parse(sizes);
  } catch (err) {
    throw new ApiError(400, "Invalid JSON in color or sizes");
  }

  // Ensure numeric values are safe
  const safeNumber = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const safeMrp = safeNumber(mrp);
  const safePrice = safeNumber(price);
  const safeDiscount = safeNumber(discount);

  // Upload images to Cloudinary (max 5)
  const MAX_IMAGES = 5;
  const uploadedImages = [];

  if (req.files && req.files.length > 0) {
    const filesToUpload = req.files.slice(0, MAX_IMAGES);
    const results = await storageService.uploadMultiple(filesToUpload, 'products');
    uploadedImages.push(...results);
  }

  // Construct the new variant object
  const newVariant = {
    color: parsedColor,
    sizes: parsedSizes,
    mrp: safeMrp,
    price: safePrice,
    discount: safeDiscount,
    images: uploadedImages,
  };

  // Update the product by pushing the variant
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



