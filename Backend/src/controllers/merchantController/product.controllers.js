import mongoose from "mongoose";
import Product from '../../models/product.model.js';
import Category from '../../models/category.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';
import Brand from "../../models/brand.model.js";
import { uploadToCloudinary } from '../../config/cloudinary.config.js';

// export const addVariant = async (req, res) => {

//   try {
//     const { productId } = req.params;
//     // Parse variant data
//     const variantData = {
//       size: req.body.size,
//       color: req.body.color ? JSON.parse(req.body.color) : {},
//       stock: Number(req.body.stock) || 0,
//       mrp: Number(req.body.mrp),
//       price: Number(req.body.price),
//       discount: Number(req.body.discount) || 0,
//       // images: store your uploaded image URLs here if you handle uploads
//     };

//     // Update product with new variant
//     const updatedProduct = await Product.findByIdAndUpdate(
//       productId,
//       { $push: { variants: variantData } },
//       { new: true }
//     );

//     if (!updatedProduct) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     res.status(200).json({
//       message: 'Variant added successfully',
//       product: updatedProduct
//     });
//   } catch (err) {
//     console.error('Error adding variant:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

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


  
