import mongoose from "mongoose";
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';
import Brand from "../../models/brand.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.config.js';
import { log } from "console";

export const addVariant = async (req, res) => {
  try {
    const { productId } = req.params;

    let { color, sizes, mrp, price, discount } = req.body;
    console.log(req.body);
    console.log(req.files);

    // Safe JSON parser
    const safeParse = (value) => {
      if (!value) return value;
      if (typeof value === "string") {
        try { return JSON.parse(value); }
        catch { return value; }
      }
      return value; // already object or array
    };

    // ---- COLOR ----
    color = safeParse(color);

    // ---- SIZES ----
    let parsedSizes = safeParse(sizes);

    if (!Array.isArray(parsedSizes)) {
      parsedSizes = [];
    }

    parsedSizes = parsedSizes.map((s) => ({
      size: s.size,
      stock: isNaN(Number(s.stock)) ? 0 : Number(s.stock),
    }));

    sizes = parsedSizes;

    // ---- IMAGES ----
    let parsedImages = safeParse(req.body.images) || [];

    // Convert numbers safely
    const safeNumber = (n) => (isNaN(Number(n)) ? 0 : Number(n));
    mrp = safeNumber(mrp);
    price = safeNumber(price);
    discount = safeNumber(discount);

    // Upload and build finalImages
    const finalImages = [];
    let fileIndex = 0;

    for (let img of parsedImages) {
      if (img.url.startsWith("http")) {
        // Existing cloudinary image
        finalImages.push({
          public_id: img.public_id,
          url: img.url,
        });
      } 
        
      else if (img.url.startsWith("blob")) {
        // New local file
        const file = req.files[fileIndex];
        if (file) {
          const upload = await uploadToCloudinary(file.buffer, "products");
          finalImages.push({
            public_id: upload.public_id,
            url: upload.secure_url,
          });
        }
        fileIndex++;
      }
    }

    // Build the variant
    const newVariant = {
      color,
      sizes,
      mrp,
      price,
      discount,
      images: finalImages,
    };

    // Save to DB
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $push: { variants: newVariant } },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Variant added successfully",
      variant: updatedProduct.variants.at(-1),
      product: updatedProduct,
    });

  } catch (err) {
    console.error("Error adding variant:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};







export const updateVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { color, mrp, price, discount, images } = req.body;

    console.log("REQ BODY:", req.body);
    console.log(req.file);
    console.log(req.files);
    // ----------------------------
    // 1) Parse incoming values
    // ----------------------------
    const parseJSON = (val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };
    const parsedColor = parseJSON(color);
    const parsedImages = parseJSON(images) || [];

    const safeNumber = (n) => (isNaN(Number(n)) ? 0 : Number(n));

    const safeMrp = safeNumber(mrp);
    const safePrice = safeNumber(price);
    const safeDiscount = safeNumber(discount);

    // ----------------------------
    // 2) Load Product + Variant
    // ----------------------------
    const product = await Product.findOne({
      _id: productId,
      "variants._id": variantId,
    });

    if (!product)
      return res.status(404).json({ message: "Product or variant not found" });

    const variant = product.variants.id(variantId);
    const oldImages = variant.images || [];

    // ----------------------------
    // 3) Identify deleted images
    // ----------------------------
    const incomingPublicIDs = parsedImages.map((img) => img.public_id);
    const deletedImages = oldImages.filter(
      (old) => !incomingPublicIDs.includes(old.public_id)
    );

    // ----------------------------
    // 4) Build new finalImages array
    // ----------------------------
    const finalImages = [];
    const MAX_IMAGES = 5;

    let fileIndex = 0;

    for (let i = 0; i < parsedImages.length; i++) {
      const img = parsedImages[i];

      // If max reached → stop adding but still maintain fileIndex alignment
      if (finalImages.length >= MAX_IMAGES) {
        // If it's a blob, still advance fileIndex so next blob doesn't mismatch
        if (img.url.startsWith("blob")) {
          fileIndex++;
        }
        continue;
      }

      // A: existing cloud image → keep
      if (img.url.startsWith("http")) {
        finalImages.push({
          public_id: img.public_id,
          url: img.url,
        });
        continue;
      }

      // B: blob image → upload using fileIndex
      if (img.url.startsWith("blob")) {
        const file = req.files?.[fileIndex];
        if (file) {
          const upload = await uploadToCloudinary(file.buffer, "products");
          finalImages.push({
            public_id: upload.public_id,
            url: upload.secure_url,
          });
        }
        fileIndex++; // increase only for blob
      }
    }

    // ----------------------------
    // 5) Delete old Cloudinary images that were removed
    // ----------------------------
    for (const img of deletedImages) {
      if (img.public_id) {
        try {
          await deleteFromCloudinary(img.public_id);
        } catch (err) {
          console.warn("Failed to delete image:", img.public_id);
        }
      }
    }

    // ----------------------------
    // 6) Prepare update object
    // ----------------------------
    const updateData = {
      "variants.$.color": parsedColor,
      "variants.$.mrp": safeMrp,
      "variants.$.price": safePrice,
      "variants.$.discount": safeDiscount,
      "variants.$.images": finalImages,
    };

    // ----------------------------
    // 7) Update database
    // ----------------------------
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Variant updated successfully.",
      product: updatedProduct,
    });
  } catch (err) {
    console.error("Error updating variant:", err);
    res.status(500).json({
      message: "Internal Server Error",
      error: err.message,
    });
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

export const updatePrice = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { mrp, price, discount } = req.body;

    // sanitize values
    const safeMRP = isNaN(Number(mrp)) ? 0 : Number(mrp);
    const safePrice = isNaN(Number(price)) ? 0 : Number(price);
    const safeDiscount = isNaN(Number(discount)) ? 0 : Number(discount);

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId },
      {
        $set: {
          "variants.$.mrp": safeMRP,
          "variants.$.price": safePrice,
          "variants.$.discount": safeDiscount,
        }
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product or variant not found" });
    }

    res.json({
      message: "Price updated successfully",
      variant: updatedProduct.variants.find(v => v._id.toString() === variantId),
    });
  } catch (err) {
    console.error("Error updating price:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
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
    console.log("getting cate............")
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
  console.log("working");

  try {
    const { merchantId } = req.params;

    const products = await Product.find({ merchantId })
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .populate("subCategoryId", "name")
      .populate("subSubCategoryId", "name")
      .populate("merchantId", "shopName email brandName")
      .sort({ createdAt: -1 }); // ✅ latest first

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found for this merchant" });
    }

    // 🔄 Transform for frontend
    const transformed = products.map((p) => ({
      id: p._id.toString(),
      name: p.name,

      merchant: {
        id: p.merchantId?._id?.toString(),
        shopName: p.merchantId?.shopName || "",
        email: p.merchantId?.email || "",
      },

      brand: p.brandId?.name || "",
      category: p.categoryId?.name || "",
      subCategory: p.subCategoryId?.name || "",
      subSubCategory: p.subSubCategoryId?.name || "",

      brandId: p.brandId?._id?.toString() || null,
      categoryId: p.categoryId?._id?.toString() || null,
      subCategoryId: p.subCategoryId?._id?.toString() || null,
      subSubCategoryId: p.subSubCategoryId?._id?.toString() || null,

      gender: p.gender,
      description: p.description,
      tags: p.tags,
      isTriable: p.isTriable,
      ratings: p.ratings,
      numReviews: p.numReviews,
      isActive: p.isActive,

      variants: p.variants,

      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json(transformed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ " + error.message });
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

    const deleted = await Product.findByIdAndDelete(productId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      message: "Product deleted successfully",
      product: deleted,
    });
  } catch (err) {
    console.error("Error deleting product:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

export const deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    // Pull variant by ID
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $pull: { variants: { _id: variantId } } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      message: "Variant deleted successfully",
      product: updatedProduct,
      variants: updatedProduct.variants,
    });
  } catch (err) {
    console.error("Error deleting variant:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};


export const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    console.log(req.body);
    console.log(id);

    // Prevent updates to protected fields
    const restrictedFields = ['_id', 'createdAt', 'updatedAt', 'variants'];
    restrictedFields.forEach((field) => delete updateData[field]);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      console.log(" not fincding producvt");
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating product',
      error: error.message,
    });
  }
};

export const editVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const updateData = req.body;
    console.log(updateData);
    console.log(productId);
    console.log(variantId);

    // Transform body keys -> variants.$.field (so Mongoose knows which variant to update)
    const updateFields = Object.fromEntries(
      Object.entries(updateData).map(([key, value]) => [`variants.$.${key}`, value])
    );

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, 'variants._id': variantId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Variant updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating variant',
      error: error.message,
    });
  }
};

export const updateVariantSizeStock = async (req, res) => {
  try {
    const { productId, variantId, sizeName } = req.params;
    const { stock } = req.body;

    if (stock === undefined) {
      return res.status(400).json({ success: false, message: "Stock value is required" });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        "variants._id": variantId,
      },
      {
        $set: {
          "variants.$[v].sizes.$[s].stock": stock,
        },
      },
      {
        new: true,
        arrayFilters: [
          { "v._id": variantId },
          { "s.size": sizeName },
        ],
        runValidators: true,
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: "Product or variant not found" });
    }

    res.status(200).json({
      success: true,
      message: `Stock updated for size '${sizeName}' in variant '${variantId}'`,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating size stock:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating stock",
      error: error.message,
    });
  }
};

export const updateMultipleVariantSizes = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { sizes } = req.body;

    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({ success: false, message: "Sizes array is required" });
    }

    // 1️⃣ Find product and variant
    const product = await Product.findOne({ _id: productId, "variants._id": variantId });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product or variant not found" });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    // 2️⃣ Create list of incoming size names (for removal logic)
    const incomingSizeNames = sizes.map((s) => s.size);

    // 3️⃣ Update or add sizes
    sizes.forEach(({ size, stock }) => {
      if (!size || stock === undefined) return; // skip invalid entries

      const existingSize = variant.sizes.find((s) => s.size === size);
      if (existingSize) {
        // ✅ Update stock
        existingSize.stock = stock;
      } else {
        // ✅ Add new size
        variant.sizes.push({ size, stock });
      }
    });

    // 4️⃣ Remove sizes that are not in incoming list
    variant.sizes = variant.sizes.filter((s) => incomingSizeNames.includes(s.size));

    // 5️⃣ Save updated product
    await product.save();

    res.status(200).json({
      success: true,
      message: "Sizes updated successfully (added, updated, and removed as needed)",
      product,
    });
  } catch (error) {
    console.error("Error updating sizes:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating sizes",
      error: error.message,
    });
  }
};

export const getAllBrands=async(req,res)=>{
  try {
    const brands=await Brand.find({isActive:true})
    res.status(200).json({
      success:true,
      message:"All brands",
      brands
    })
  } catch (error) {
    res.status(500).json({
      success:false,
      message:"Server error while getting brands",
      error:error.message
    })
  }
}

