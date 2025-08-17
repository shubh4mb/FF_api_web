import mongoose from "mongoose";
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';
import Brand from "../../models/brand.model.js";
import { uploadToCloudinary } from '../../config/cloudinary.config.js';
import { log } from "console";

export const addVariant = async (req, res) => {
  try {
    console.log("Files received:", req.files);

//     await Product.deleteMany({ variants: [] });
// console.log("All products with empty variants deleted.");

    const productId = req.params.productId;
    const { color, sizes, mrp, price, discount } = req.body;

    // Parse JSON strings safely
    let parsedColor, parsedSizes;
    try {
      parsedColor = JSON.parse(color);
      parsedSizes = JSON.parse(sizes);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid JSON in color or sizes' });
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
      console.log(req.files);
      
      const filesToUpload = req.files.slice(0, MAX_IMAGES);
      for (const file of filesToUpload) {
        const result = await uploadToCloudinary(file.buffer, 'products');
        console.log("working");
        uploadedImages.push({
          public_id: result.public_id,
          url: result.secure_url,
        });
      }
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
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.status(200).json({
      message: 'Variant added successfully',
      product: updatedProduct,
    });
  } catch (err) {
    console.error('Error adding variant:', err);
    res.status(500).json({
      message: 'Internal Server Error',
      error: err.message,
    });
  }
};
export const updateVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { color, sizes, mrp, price, discount } = req.body;

    let parsedColor = JSON.parse(color);
    let parsedSizes = JSON.parse(sizes);

    const safeNumber = (val) => isNaN(Number(val)) ? 0 : Number(val);
    const safeMrp = safeNumber(mrp);
    const safePrice = safeNumber(price);
    const safeDiscount = safeNumber(discount);

    const MAX_IMAGES = 5;
    const uploadedImages = [];

    if (req.files?.length > 0) {
      const filesToUpload = req.files.slice(0, MAX_IMAGES);
      for (const file of filesToUpload) {
        const result = await uploadToCloudinary(file.buffer, "products");
        uploadedImages.push({ public_id: result.public_id, url: result.secure_url });
      }
    }

    const updateData = {
      "variants.$.color": parsedColor,
      "variants.$.sizes": parsedSizes,
      "variants.$.mrp": safeMrp,
      "variants.$.price": safePrice,
      "variants.$.discount": safeDiscount,
    };

    if (uploadedImages.length > 0) {
      updateData["variants.$.images"] = uploadedImages;
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedProduct) return res.status(404).json({ message: "Variant not found" });

    res.json({ message: "Variant updated successfully", product: updatedProduct });

  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};


export const addBaseProduct = async (req, res) => {
  console.log("Incoming Body:", req.body);

  try {
    const { error, value } = productSchema.validate(req.body, { abortEarly: false });

    if (error) {
      console.log("Validation Errors:", error.details);
      return res.status(400).json({ message: "Validation failed", errors: error.details });
    }

    const product = new Product(value);
    await product.save();

    res.status(201).json({
      message: '✅ Product added successfully',
      product
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '❌ ' + err.message });
  }
};

  export const getVariants = async (req, res) => {
    try {
      const products = await Product.find({});
      res.status(200).json(products);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: '❌ ' + error.message });
    }
  };

  export const getBaseProducts = async (req, res) => {
    console.log("hi");
    
    try {
      const products = await Product.find({});
      res.status(200).json(products);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: '❌ ' + error.message });
    }
  };

export const getCategories = async (req, res) => {
    try {
      const categories = await Category
    .find({ isActive: true })
      res.status(200).json({ categories });
    } catch (error) {
      res.status(500).json({ message: "❌ " + error.message });
    }
  };
  
export const addBrand = async (req, res) => {
  try {
    const { name, description, createdById, createdByType } = req.body;

    let logoData = null;

    // If a logo file is uploaded, send it to Cloudinary
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: 'brands',
        resource_type: 'image',
      });

      logoData = {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
      };
    }

    // Create the brand
    const brand = await Brand.create({
      name,
      description,
      logo: logoData,
      createdById,
      createdByType,
    });

    res.status(201).json({ brand });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: error.message });
  }
};

// controller.js
export const getBrands = async (req, res) => {
  try {
    const { merchantId } = req.query;

    let brands;

    if (merchantId && mongoose.Types.ObjectId.isValid(merchantId)) {
      brands = await Brand.find({
        createdById: new mongoose.Types.ObjectId(merchantId),
        createdByType: "Merchant" // Optional filter for merchants only
      });

      // console.log("Brands fetched for merchant:", merchantId, brands);
    } else if (merchantId) {
      return res.status(400).json({ error: "Invalid merchantId" });
    } else {
      brands = await Brand.find({});
    }

    res.status(200).json({ brands });
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getBaseProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId)
        .populate('brandId', 'name') // Only get the 'name' field of the Brand
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('subSubCategoryId', 'name')
        .populate('merchantId', 'name')
        
        res.status(200).json(product);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
      }
}


export const getProductsByMerchantId = async (req, res) => {
  try {
    const { merchantId } = req.params;
    // console.log(merchantId, 'merchantId <<<');

    const products = await Product.find({ merchantId })
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('subSubCategoryId', 'name')
      .populate('merchantId', 'shopName email brandName');

    if (!products || products.length === 0) {
      return res.status(404).json({ message: 'No products found for this merchant' });
    }

    // ✅ keep variants intact
    const transformed = products.map(p => ({
      id: p._id.toString(), // ⚠️ frontend expects `product.id`, not `_id`
      name: p.name,
      merchant: {
        id: p.merchantId?._id,
        shopName: p.merchantId?.shopName,
        email: p.merchantId?.email,
      },
      brand: p.brandId?.name || "",
      category: p.categoryId?.name || "",
      subCategory: p.subCategoryId?.name || "",
      subSubCategory: p.subSubCategoryId?.name || "",
      gender: p.gender,
      description: p.description,
      tags: p.tags,
      isTriable: p.isTriable,
      ratings: p.ratings,
      numReviews: p.numReviews,
      isActive: p.isActive,
      variants: p.variants,   // ✅ untouched, full array with sizes[]
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json(transformed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

export const uploadProductImage = async (req, res) => {

  try {
    const { productId, variantIndex } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    // Upload to cloudinary
    const uploadedImages = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer, "products");
      uploadedImages.push({
        public_id: result.public_id,
        url: result.secure_url,
      });
    }

    // ✅ Update product variant images in DB
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Ensure variant exists
    if (!product.variants[variantIndex]) {
      return res.status(400).json({ message: "Invalid variant index" });
    }

    // Push images into the variant's images array
    product.variants[variantIndex].images.push(...uploadedImages);

    await product.save();

    return res.status(200).json({
      message: "✅ Images uploaded successfully",
      images: product.variants[variantIndex].images,// return updated array
    });

  } catch (err) {
    console.error("Error uploading images:", err);
    res.status(500).json({
      message: "❌ Internal Server Error",
      error: err.message,
    });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    // Find product containing this image
    const product = await Product.findOne({ 'variants.images._id': imageId });
    if (!product) return res.status(404).json({ error: 'Image not found' });

    // Find variant containing the image
    product.variants.forEach(variant => {
      variant.images = variant.images.filter(img => img._id.toString() !== imageId);
    });

    await product.save();
    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

