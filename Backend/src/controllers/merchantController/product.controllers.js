import mongoose from "mongoose";
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';
import Brand from "../../models/brand.model.js";
import { uploadToCloudinary } from '../../config/cloudinary.config.js';
import { log } from "console";

export const addVariant = async (req, res) => {
  try {
    const productId = req.params.productId;
    const { color, sizes, mrp, price, discount } = req.body;

    // Parse JSON safely
    let parsedColor, parsedSizes;
    try {
      parsedColor = JSON.parse(color);
      parsedSizes = JSON.parse(sizes);
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON in color or sizes" });
    }

    // Ensure numeric values are safe
    const safeNumber = (val) => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    const safeMrp = safeNumber(mrp);
    const safePrice = safeNumber(price);
    const safeDiscount = safeNumber(discount);

    // Upload images to Cloudinary (limit 5)
    const MAX_IMAGES = 5;
    const uploadedImages = [];

    if (req.files && req.files.length > 0) {
      const filesToUpload = req.files.slice(0, MAX_IMAGES);
      for (const file of filesToUpload) {
        const result = await uploadToCloudinary(file.buffer, "products");
        uploadedImages.push({
          public_id: result.public_id,
          url: result.secure_url,
        });
      }
    }

    // New variant object
    const newVariant = {
      color: parsedColor,
      sizes: parsedSizes,
      mrp: safeMrp,
      price: safePrice,
      discount: safeDiscount,
      images: uploadedImages,
    };

    // Push variant & return populated product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $push: { variants: newVariant } },
      { new: true, runValidators: true }
    )
      .populate("brandId", "name") // populate brand name
      .populate("categoryId", "name") // populate category name
      .populate("merchantId", "name email"); // populate merchant details

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      message: "Variant added successfully",
      product: updatedProduct,
    });
  } catch (err) {
    console.error("Error adding variant:", err);
    res.status(500).json({
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

export const deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    // Find product and remove variant
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $pull: { variants: { _id: variantId } } },
      { new: true }
    )
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .populate("merchantId", "name email");

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      message: "Variant deleted successfully",
      product: updatedProduct,
    });
  } catch (err) {
    console.error("Error deleting variant:", err);
    res.status(500).json({
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

export const updateVariant = async (req, res) => {

  console.log(req.params.productId,'productIdproductIdproductId');
  
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

export const updateSize = async (req, res) => {
  try {
    const { productId, variantId, sizeId } = req.params; // sizeId optional
    const { size, stock } = req.body; // size name & stock from frontend

    const safeStock = isNaN(Number(stock)) ? 0 : Number(stock);

    let updatedProduct;

    if (sizeId) {
      // ✅ Update existing size by _id
      updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, "variants._id": variantId, "variants.sizes._id": sizeId },
        { $set: { "variants.$[v].sizes.$[s].stock": safeStock } },
        {
          new: true,
          arrayFilters: [
            { "v._id": variantId },
            { "s._id": sizeId }
          ]
        }
      );
    } else {
      // ✅ Add new size
      updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, "variants._id": variantId },
        { $push: { "variants.$.sizes": { size, stock: safeStock } } },
        { new: true }
      );
    }

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product or variant not found" });
    }

    res.json({
      message: sizeId ? "Stock updated successfully" : "New size added",
      product: updatedProduct.variants
    });
  } catch (err) {
    console.error("Error updating stock:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

export const updateSizeCount = async (req, res) => {
  try {
    const { productId, variantId, sizeId } = req.params;
    const { stock } = req.body; // Only need stock from frontend

    // Validate required parameters
    if (!sizeId) {
      return res.status(400).json({ 
        message: "Size ID is required for stock updates" 
      });
    }

    const safeStock = isNaN(Number(stock)) ? 0 : Number(stock);

    // ✅ Only update existing size stock by _id
    const updatedProduct = await Product.findOneAndUpdate(
      { 
        _id: productId, 
        "variants._id": variantId, 
        "variants.sizes._id": sizeId 
      },
      { 
        $set: { "variants.$[v].sizes.$[s].stock": safeStock } 
      },
      {
        new: true,
        arrayFilters: [
          { "v._id": variantId },
          { "s._id": sizeId }
        ]
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({ 
        message: "Product, variant, or size not found" 
      });
    }

    res.json({
      message: "Stock updated successfully",
      product: updatedProduct.variants
    });
  } catch (err) {
    console.error("Error updating stock:", err);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: err.message 
    });
  }
};


export const deleteVariantSizes = async (req, res) => {
  try {
    const { productId, variantId, sizeId } = req.params;

    // ✅ Pull a specific size by _id
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId },
      { $pull: { "variants.$.sizes": { _id: sizeId } } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product, variant or size not found" });
    }

    res.json({
      message: "Size deleted successfully",
      product: updatedProduct
    });
  } catch (err) {
    console.error("Error deleting size:", err);
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
      // console.log(products,'productsproducts');
      

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

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Find and delete product
    const deletedProduct = await Product.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      message: "Product deleted successfully",
      product: deletedProduct
    });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({
      message: "Internal Server Error",
      error: err.message,
    });
  }
};
