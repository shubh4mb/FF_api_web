import mongoose from "mongoose";
import Category from '../../models/category.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';
import Brand from "../../models/brand.model.js";
import Merchant from "../../models/merchant.model.js";
import { storageService } from '../../services/storage.service.js';
import ProductFlat from '../../models/productFlat.model.js';
import { convertToLegacyFormat, generateColorVariantId } from '../../utils/variantAdapter.js';
import crypto from 'crypto';

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

export const addVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    let { color, sizes, mrp, price, discount, productSku } = req.body;

    const safeParse = (value) => {
      if (!value) return value;
      if (typeof value === "string") {
        try { return JSON.parse(value); }
        catch { return value; }
      }
      return value;
    };

    color = safeParse(color);
    let parsedSizes = safeParse(sizes);
    if (!Array.isArray(parsedSizes)) {
      parsedSizes = [];
    }
    parsedSizes = parsedSizes.map((s) => ({
      size: s.size,
      merchantSizeCode: s.merchantSizeCode,
      stock: isNaN(Number(s.stock)) ? 0 : Number(s.stock),
    }));
    sizes = parsedSizes;

    let parsedImages = safeParse(req.body.images) || [];
    const safeNumber = (n) => (isNaN(Number(n)) ? 0 : Number(n));
    mrp = safeNumber(mrp);
    price = safeNumber(price);
    discount = safeNumber(discount);

    const finalImages = [];
    let fileIndex = 0;
    for (let img of parsedImages) {
      if (img.url.startsWith("http")) {
        finalImages.push({ public_id: img.public_id, url: img.url });
      } else if (img.url.startsWith("blob")) {
        const file = req.files[fileIndex];
        if (file) {
          const result = await storageService.uploadSingle(file, "products");
          if (result) finalImages.push(result);
        }
        fileIndex++;
      }
    }

      const existingFlatProduct = await ProductFlat.findOne({ styleGroupId: productId, merchantId: req.merchantId });
      if (!existingFlatProduct) {
        return res.status(404).json({ success: false, message: "Product group not found" });
      }

      const merchant = await Merchant.findById(req.merchantId);
      if (!merchant) return res.status(404).json({ success: false, message: "Merchant not found" });

      const cleanShop = merchant.shopName ? merchant.shopName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() : "SH";
      const last4 = merchant._id.toString().slice(-4).toUpperCase();
      const merchantPrefix = `${cleanShop}-${last4}`;

      const base = existingFlatProduct.toObject();
      delete base._id;
      delete base.__v;
      delete base.createdAt;
      delete base.updatedAt;

      const { name: reqName, styleName: reqStyleName, description: reqDesc, gender: reqGender, isTriable: reqTriable } = req.body;
      if (reqName && reqName.trim()) base.name = reqName.trim();
      if (reqStyleName && reqStyleName.trim()) base.styleName = reqStyleName.trim();
      if (reqDesc && reqDesc.trim()) base.description = reqDesc.trim();
      if (reqGender) base.gender = safeParse(reqGender);
      if (reqTriable !== undefined) base.isTriable = reqTriable === 'true' || reqTriable === true;

      for (const sizeObj of sizes) {
        const cleanSize = sizeObj.size.replace(/\s+/g, '').toUpperCase();
        let productCode;
        let baseSku = sizeObj.merchantSizeCode || productSku;
        if (baseSku) {
          productCode = `${merchantPrefix}-${baseSku.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
        } else {
          const parentProductCode = existingFlatProduct.productCode.split('-')[0] || existingFlatProduct.productCode;
          const cleanColor = (color?.name || 'Default').replace(/\s+/g, '').toUpperCase();
          productCode = `${parentProductCode}-${cleanColor}-${cleanSize}`;
        }

        const flatDoc = new ProductFlat({
          ...base,
          productCode,
          color,
          size: sizeObj.size,
          merchantSizeCode: sizeObj.merchantSizeCode,
          stock: sizeObj.stock,
          mrp,
          price,
          discount,
          images: finalImages
        });
        await flatDoc.save();
      }

      // Clean up placeholder dummy variant if still there
      await ProductFlat.deleteOne({
        styleGroupId: productId,
        size: 'Free',
        'color.name': 'Default',
        stock: 0,
        price: 0,
        merchantId: req.merchantId
      });

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.json({
        success: true,
        message: "Variant added successfully",
        product: makeFlatPayload(siblings, { addedColorName: color.name })
      });
  } catch (err) {
    console.error("Error adding variant:", err);
    res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};

export const updateVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { color, mrp, price, discount, images, productSku } = req.body;

    const parseJSON = (val) => {
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };
    const parsedColor = parseJSON(color);
    const parsedImages = parseJSON(images) || [];
    const safeNumber = (n) => (isNaN(Number(n)) ? 0 : Number(n));
    const safeMrp = safeNumber(mrp);
    const safePrice = safeNumber(price);
    const safeDiscount = safeNumber(discount);

      const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, merchantId: req.merchantId });
      const targetColorVariants = allFlatVariants.filter(
        v => generateColorVariantId(productId, v.color.name) === variantId
      );
      if (!targetColorVariants.length) {
        return res.status(404).json({ message: "Product or variant not found" });
      }

      const merchant = await Merchant.findById(req.merchantId);
      if (!merchant) return res.status(404).json({ success: false, message: "Merchant not found" });

      const cleanShop = merchant.shopName ? merchant.shopName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() : "SH";
      const last4 = merchant._id.toString().slice(-4).toUpperCase();
      const merchantPrefix = `${cleanShop}-${last4}`;

      const oldColorName = targetColorVariants[0].color.name;
      const oldImages = targetColorVariants[0].images || [];

      const incomingPublicIDs = parsedImages.map((img) => img.public_id);
      const deletedImages = oldImages.filter(
        (old) => !incomingPublicIDs.includes(old.public_id)
      );

      const finalImages = [];
      const MAX_IMAGES = 5;
      let fileIndex = 0;
      for (let i = 0; i < parsedImages.length; i++) {
        const img = parsedImages[i];
        if (finalImages.length >= MAX_IMAGES) {
          if (img.url.startsWith("blob")) fileIndex++;
          continue;
        }
        if (img.url.startsWith("http")) {
          finalImages.push({ public_id: img.public_id, url: img.url });
          continue;
        }
        if (img.url.startsWith("blob")) {
          const file = req.files?.[fileIndex];
          if (file) {
            const result = await storageService.uploadSingle(file, "products");
            if (result) finalImages.push(result);
          }
          fileIndex++;
        }
      }

      for (const img of deletedImages) {
        if (img.public_id) {
          await storageService.deleteFile(img.public_id);
        }
      }

      for (const variantDoc of targetColorVariants) {
        const cleanSize = variantDoc.size.replace(/\s+/g, '').toUpperCase();
        let newProductCode;
        if (productSku) {
          newProductCode = `${merchantPrefix}-${productSku.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
        } else {
          const parentProductCode = variantDoc.productCode.split('-')[0] || variantDoc.productCode;
          const cleanNewColor = (parsedColor?.name || 'Default').replace(/\s+/g, '').toUpperCase();
          newProductCode = `${parentProductCode}-${cleanNewColor}-${cleanSize}`;
        }

        await ProductFlat.updateOne(
          { _id: variantDoc._id },
          {
            $set: {
              color: parsedColor,
              mrp: safeMrp,
              price: safePrice,
              discount: safeDiscount,
              images: finalImages,
              productCode: newProductCode
            }
          }
        );
      }

      const updatedSiblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.status(200).json({
        success: true,
        message: "Variant updated successfully.",
        product: makeFlatPayload(updatedSiblings),
      });
  } catch (err) {
    console.error("Error updating variant:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

export const updateSize = async (req, res) => {
  try {
    const { productId, variantId, sizeId } = req.params;
    const { size, stock } = req.body;
    const safeStock = isNaN(Number(stock)) ? 0 : Number(stock);

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      let updatedFlatDoc;
      if (sizeId) {
        const isObjId = mongoose.Types.ObjectId.isValid(sizeId);
        const query = isObjId
          ? { _id: sizeId, merchantId: req.merchantId }
          : { styleGroupId: productId, size: sizeId, merchantId: req.merchantId };

        updatedFlatDoc = await ProductFlat.findOneAndUpdate(
          query,
          { $set: { stock: safeStock } },
          { new: true }
        );
      } else {
        const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, merchantId: req.merchantId });
        const targetColorVariants = allFlatVariants.filter(
          v => generateColorVariantId(productId, v.color.name) === variantId
        );
        if (!targetColorVariants.length) {
          return res.status(404).json({ message: "Color variant group not found" });
        }

        const baseVariant = targetColorVariants[0].toObject();
        delete baseVariant._id;
        delete baseVariant.__v;
        delete baseVariant.createdAt;
        delete baseVariant.updatedAt;

        const parentProductCode = baseVariant.productCode.split('-')[0] || baseVariant.productCode;
        const cleanColor = baseVariant.color.name.replace(/\s+/g, '').toUpperCase();
        const cleanSize = size.replace(/\s+/g, '').toUpperCase();

        const newSizeDoc = new ProductFlat({
          ...baseVariant,
          size: size,
          stock: safeStock,
          productCode: `${parentProductCode}-${cleanColor}-${cleanSize}`
        });
        updatedFlatDoc = await newSizeDoc.save();
      }

      if (!updatedFlatDoc) {
        return res.status(404).json({ message: "Product or size not found" });
      }

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.json({
        message: sizeId ? "Stock updated successfully" : "New size added",
        product: makeFlatPayload(siblings)
      });
    }

    let updatedProduct;
    if (sizeId) {
      updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, merchantId: req.merchantId, "variants._id": variantId, "variants.sizes._id": sizeId },
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
      updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, merchantId: req.merchantId, "variants._id": variantId },
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
    const { stock } = req.body;

    if (!sizeId) {
      return res.status(400).json({ message: "Size ID is required for stock updates" });
    }
    const safeStock = isNaN(Number(stock)) ? 0 : Number(stock);

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const updatedFlatDoc = await ProductFlat.findOneAndUpdate(
        { _id: sizeId, styleGroupId: productId, merchantId: req.merchantId },
        { $set: { stock: safeStock } },
        { new: true }
      );
      if (!updatedFlatDoc) {
        return res.status(404).json({ message: "Product, variant, or size not found" });
      }

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.json({
        message: "Stock updated successfully",
        product: makeFlatPayload(siblings)
      });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, merchantId: req.merchantId, "variants._id": variantId, "variants.sizes._id": sizeId },
      { $set: { "variants.$[v].sizes.$[s].stock": safeStock } },
      {
        new: true,
        arrayFilters: [
          { "v._id": variantId },
          { "s._id": sizeId }
        ]
      }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product, variant, or size not found" });
    }
    res.json({
      message: "Stock updated successfully",
      product: updatedProduct.variants
    });
  } catch (err) {
    console.error("Error updating stock:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

export const updatePrice = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { mrp, price, discount } = req.body;
    const safeMRP = isNaN(Number(mrp)) ? 0 : Number(mrp);
    const safePrice = isNaN(Number(price)) ? 0 : Number(price);
    const safeDiscount = isNaN(Number(discount)) ? 0 : Number(discount);

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, merchantId: req.merchantId });
      const targetColorVariants = allFlatVariants.filter(
        v => generateColorVariantId(productId, v.color.name) === variantId
      );
      if (!targetColorVariants.length) {
        return res.status(404).json({ message: "Product or variant not found" });
      }

      const colorName = targetColorVariants[0].color.name;
      await ProductFlat.updateMany(
        { styleGroupId: productId, "color.name": colorName, merchantId: req.merchantId },
        { $set: { mrp: safeMRP, price: safePrice, discount: safeDiscount } }
      );

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.json({
        message: "Price updated successfully",
        product: makeFlatPayload(siblings, { addedColorName: colorName })
      });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, merchantId: req.merchantId, "variants._id": variantId },
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

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      await ProductFlat.deleteOne({ _id: sizeId, styleGroupId: productId, merchantId: req.merchantId });
      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.json({
        message: "Size deleted successfully",
        product: makeFlatPayload(siblings)
      });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, merchantId: req.merchantId, "variants._id": variantId },
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

    const flatFields = {
      color: req.body.color,
      size: req.body.size,
      stock: req.body.stock,
      price: req.body.price,
      mrp: req.body.mrp,
      discount: req.body.discount,
      images: req.body.images,
      styleGroupId: req.body.styleGroupId
    };

    const bodyCopy = { ...req.body };
    delete bodyCopy.color;
    delete bodyCopy.size;
    delete bodyCopy.stock;
    delete bodyCopy.price;
    delete bodyCopy.mrp;
    delete bodyCopy.discount;
    delete bodyCopy.images;
    delete bodyCopy.styleGroupId;

    const { error, value } = productSchema.validate(bodyCopy, { abortEarly: false, allowUnknown: true });

    if (error) {
      console.log("Validation Errors:", error.details);
      return res.status(400).json({ message: "Validation failed", errors: error.details });
    }

    // Auto-create or find brand based on merchant's shopName
    // FORCE merchantId from auth token to prevent IDOR
    value.merchantId = req.merchantId;

    if (value.merchantId) {
      const merchant = await Merchant.findById(value.merchantId);
      if (merchant) {
        const brandName = merchant.shopName || merchant.ownerName || "Default Brand";
        
        // Auto-assign soldBy
        value.soldBy = merchant.shopName || merchant.ownerName || "Default Store";

        let brand = await Brand.findOne({ name: brandName, createdById: merchant._id });
        if (!brand) {
          brand = await Brand.create({
            name: brandName,
            createdByType: 'Merchant',
            createdById: merchant._id,
          });
        }
        value.brandId = brand._id;
      } else {
        return res.status(404).json({ message: "Merchant not found" });
      }
    }

    // ── Gender vs Category Validation ──
    const leafCategoryId = value.subCategoryId || value.categoryId;
    const leafCategory = await Category.findById(leafCategoryId).lean();
    if (leafCategory && leafCategory.allowedGenders) {
      const isValid = value.gender.every(g => leafCategory.allowedGenders.includes(g));
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid gender for selected category. Allowed: ' + leafCategory.allowedGenders.join(', ') });
      }
    }

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const generatedGroupId = flatFields.styleGroupId || new mongoose.Types.ObjectId().toString();
      
      let parsedColor = flatFields.color || { name: 'Default', hex: '' };
      if (typeof parsedColor === 'string') {
        try { parsedColor = JSON.parse(parsedColor); } catch { parsedColor = { name: parsedColor, hex: '' }; }
      }
      
      let parsedImages = flatFields.images || [];
      if (typeof parsedImages === 'string') {
        try { parsedImages = JSON.parse(parsedImages); } catch { parsedImages = []; }
      }

      const product = new ProductFlat({
        ...value,
        styleGroupId: generatedGroupId,
        color: parsedColor,
        size: flatFields.size || 'Free',
        stock: isNaN(Number(flatFields.stock)) ? 0 : Number(flatFields.stock),
        mrp: isNaN(Number(flatFields.mrp)) ? 0 : Number(flatFields.mrp),
        price: isNaN(Number(flatFields.price)) ? 0 : Number(flatFields.price),
        discount: isNaN(Number(flatFields.discount)) ? 0 : Number(flatFields.discount),
        images: parsedImages,
        attributes: value.attributes || []
      });
      const parentProductCode = product.productCode || `PRD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const cleanColor = (product.color.name || 'DEFAULT').replace(/\s+/g, '').toUpperCase();
      const cleanSize = (product.size || 'FREE').replace(/\s+/g, '').toUpperCase();
      product.productCode = `${parentProductCode}-${cleanColor}-${cleanSize}`;
      
      await product.save();

      return res.status(201).json({
        success: true,
        message: '✅ Product added successfully',
        product
      });
    }

    const product = new Product({
      ...value,
      attributes: value.attributes || []
    });
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

const getReconstructedLegacyProducts = async (query = {}, populateFields = []) => {
  let queryBuilder = ProductFlat.find(query);
  populateFields.forEach(field => {
    if (typeof field === 'string') {
      queryBuilder = queryBuilder.populate(field);
    } else {
      queryBuilder = queryBuilder.populate(field.path, field.select);
    }
  });
  const flatProducts = await queryBuilder;
  if (!flatProducts.length) return [];
  const groups = {};
  flatProducts.forEach(p => {
    const gid = p.styleGroupId;
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(p);
  });
  const results = [];
  for (const gid in groups) {
    const siblings = groups[gid];
    results.push({
      isFlatPayload: true,
      activeProduct: siblings[0],
      siblings: siblings.slice(1)
    });
  }
  return results;
};

export const getVariants = async (req, res) => {
  try {
    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const flatProducts = await ProductFlat.find({ isDeleted: { $ne: true } })
        .populate("brandId", "name")
        .populate("categoryId", "name")
        .populate("subCategoryId", "name")
        .populate("merchantId", "shopName email brandName")
        .sort({ createdAt: -1 });

      const transformed = flatProducts.map((p) => ({
        id: p._id.toString(),
        productCode: p.productCode,
        name: p.name,
        brand: p.brandId?.name || "",
        category: p.categoryId?.name || "",
        subCategory: p.subCategoryId?.name || "",
        color: p.color,
        size: p.size,
        stock: p.stock,
        price: p.price,
        mrp: p.mrp,
        images: p.images
      }));
      return res.status(200).json(transformed);
    }
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

export const getBaseProducts = async (req, res) => {
  try {
    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const flatProducts = await ProductFlat.find({ isDeleted: { $ne: true } })
        .populate("brandId", "name")
        .populate("categoryId", "name")
        .populate("subCategoryId", "name")
        .populate("merchantId", "shopName email brandName")
        .sort({ createdAt: -1 });

      const transformed = flatProducts.map((p) => ({
        id: p._id.toString(),
        productCode: p.productCode,
        name: p.name,
        brand: p.brandId?.name || "",
        category: p.categoryId?.name || "",
        subCategory: p.subCategoryId?.name || "",
        color: p.color,
        size: p.size,
        stock: p.stock,
        price: p.price,
        mrp: p.mrp,
        images: p.images
      }));
      return res.status(200).json(transformed);
    }
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
      const result = await storageService.uploadSingle(req.file, 'brands');
      if (result) logoData = result;
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
    const { productId } = req.params;
    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      let doc = null;

      // 1. Try finding ProductFlat by _id if valid ObjectId
      if (mongoose.Types.ObjectId.isValid(productId)) {
        doc = await ProductFlat.findById(productId)
          .populate('brandId', 'name')
          .populate('categoryId', 'name')
          .populate('subCategoryId', 'name')
          .populate('merchantId', 'name');
      }

      // 2. If not found by _id, try finding ProductFlat by styleGroupId
      if (!doc) {
        doc = await ProductFlat.findOne({ styleGroupId: productId, isDeleted: { $ne: true } })
          .populate('brandId', 'name')
          .populate('categoryId', 'name')
          .populate('subCategoryId', 'name')
          .populate('merchantId', 'name');
      }

      if (!doc) {
        // 3. Fallback to legacy Product collection (used by warehouse products)
        let legacyProd = null;
        if (mongoose.Types.ObjectId.isValid(productId)) {
          legacyProd = await Product.findById(productId)
            .populate('brandId', 'name')
            .populate('categoryId', 'name')
            .populate('subCategoryId', 'name')
            .populate('merchantId', 'shopName name');
        }

        if (legacyProd) {
          const firstVariant = legacyProd.variants?.[0];
          const legacyObj = {
            _id: legacyProd._id.toString(),
            name: legacyProd.name,
            brand: legacyProd.brandId?.name || "",
            brandId: legacyProd.brandId?._id?.toString() || "",
            category: legacyProd.categoryId?.name || "",
            categoryId: legacyProd.categoryId?._id?.toString() || "",
            subCategory: legacyProd.subCategoryId?.name || "",
            subCategoryId: legacyProd.subCategoryId?._id?.toString() || "",
            gender: legacyProd.gender,
            description: legacyProd.description,
            tags: legacyProd.tags,
            isTriable: legacyProd.isTriable,
            isActive: legacyProd.isActive,
            color: firstVariant?.color || { name: "", hex: "" },
            mrp: firstVariant?.mrp || 0,
            price: firstVariant?.price || 0,
            discount: firstVariant?.discount || 0,
            images: firstVariant?.images || [],
            sizes: firstVariant?.sizes || []
          };
          return res.status(200).json({
            ...legacyObj,
            product: legacyObj
          });
        }
        return res.status(404).json({ message: "Product not found" });
      }

      const siblings = await ProductFlat.find({ 
        styleGroupId: doc.styleGroupId, 
        "color.name": doc.color?.name || "Default",
        isDeleted: { $ne: true }
      }).populate('brandId', 'name')
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('merchantId', 'name');

      const productDetails = {
        _id: doc._id.toString(),
        styleGroupId: doc.styleGroupId,
        name: doc.name,
        brand: typeof doc.brandId === 'object' && doc.brandId ? doc.brandId.name : (doc.brand || doc.soldBy || ""),
        brandId: typeof doc.brandId === 'object' && doc.brandId ? doc.brandId._id?.toString() : (doc.brandId || ""),
        soldBy: doc.soldBy || "",
        styleName: doc.styleName || "",
        category: typeof doc.categoryId === 'object' && doc.categoryId ? doc.categoryId.name : (doc.category || ""),
        categoryId: typeof doc.categoryId === 'object' && doc.categoryId ? doc.categoryId._id?.toString() : (doc.categoryId || ""),
        subCategory: typeof doc.subCategoryId === 'object' && doc.subCategoryId ? doc.subCategoryId.name : (doc.subCategory || ""),
        subCategoryId: typeof doc.subCategoryId === 'object' && doc.subCategoryId ? doc.subCategoryId._id?.toString() : (doc.subCategoryId || ""),
        gender: doc.gender,
        description: doc.description,
        tags: doc.tags,
        isTriable: doc.isTriable,
        isActive: doc.isActive,
        color: doc.color,
        mrp: doc.mrp,
        price: doc.price,
        discount: doc.discount,
        images: doc.images,
        attributes: (doc.attributes || []).map(a => ({
          attributeId: a.attributeId?._id?.toString() || a.attributeId?.toString() || "",
          value: a.value
        })),
        features: doc.features instanceof Map ? Object.fromEntries(doc.features) : (doc.features || {}),
        collectionIds: (doc.collectionIds || []).map(c => c?._id?.toString() || c?.toString() || ""),
        sizes: siblings.map(s => ({
          _id: s._id.toString(),
          size: s.size,
          merchantSizeCode: s.merchantSizeCode,
          stock: s.stock
        }))
      };

      return res.status(200).json({
        ...productDetails,
        product: productDetails
      });
    }

    let product = null;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId)
        .populate('brandId', 'name')
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('merchantId', 'name');
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      ...product.toObject(),
      product
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

const cleanAttributesHelper = (attrs) => {
  if (!Array.isArray(attrs)) return [];
  return attrs.map(a => {
    let rawId = a.attributeId || a.attribute;
    if (rawId && typeof rawId === 'object') {
      rawId = rawId._id || rawId.id;
    }
    return {
      attributeId: rawId ? rawId.toString() : '',
      value: a.value
    };
  }).filter(a => a.attributeId);
};

export const getProductsByMerchantId = async (req, res) => {
  console.log("workinggggggg222");

  try {
    const { merchantId } = req.params;
    console.log(merchantId);

    if (merchantId) {
      const merchant = await Merchant.findById(merchantId);
      if (merchant && merchant.accountType === 'warehouse' && merchant.warehouseId) {
        // Fetch from Product model since warehouse products use the Product schema
        const products = await Product.find({ warehouseId: merchant.warehouseId, source: 'warehouse', isDeleted: { $ne: true } })
          .populate("brandId", "name")
          .populate("categoryId", "name")
          .populate("subCategoryId", "name")
          .populate("merchantId", "shopName email brandName")
          .sort({ createdAt: -1 });

        // Transform into the flat format expected by ProductTable
        const transformed = [];
        products.forEach(p => {
          if (!p.variants || p.variants.length === 0) {
            transformed.push({
              id: p._id.toString(), name: p.name, productCode: p.productCode,
              merchant: { id: p.merchantId?._id?.toString(), shopName: p.merchantId?.shopName || "", email: p.merchantId?.email || "" },
              brand: p.brandId?.name || "", category: p.categoryId?.name || "", subCategory: p.subCategoryId?.name || "",
              brandId: p.brandId?._id?.toString() || null, categoryId: p.categoryId?._id?.toString() || null, subCategoryId: p.subCategoryId?._id?.toString() || null,
              gender: p.gender, description: p.description, tags: p.tags, isTriable: p.isTriable,
              styleName: p.styleName || "",
              attributes: cleanAttributesHelper(p.attributes),
              features: p.features || {},
              ratings: p.ratings, numReviews: p.numReviews, isActive: p.isActive,
              createdAt: p.createdAt, updatedAt: p.updatedAt,
              sizes: []
            });
            return;
          }
          
          p.variants.forEach(v => {
            transformed.push({
              id: v._id.toString(), // use variant ID as row ID for editing
              styleGroupId: p._id.toString(),
              name: p.name, productCode: p.productCode,
              styleName: p.styleName || "",
              attributes: cleanAttributesHelper(p.attributes),
              features: p.features || {},
              merchant: { id: p.merchantId?._id?.toString(), shopName: p.merchantId?.shopName || "", email: p.merchantId?.email || "" },
              brand: p.brandId?.name || "", category: p.categoryId?.name || "", subCategory: p.subCategoryId?.name || "",
              brandId: p.brandId?._id?.toString() || null, categoryId: p.categoryId?._id?.toString() || null, subCategoryId: p.subCategoryId?._id?.toString() || null,
              gender: p.gender, description: p.description, tags: p.tags, isTriable: p.isTriable,
              ratings: p.ratings, numReviews: p.numReviews, isActive: p.isActive,
              color: v.color, mrp: v.mrp, price: v.price, discount: v.discount, images: v.images, sizes: v.sizes,
              createdAt: p.createdAt, updatedAt: p.updatedAt,
            });
          });
        });
        
        return res.status(200).json(transformed);
      }
    }

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const flatProducts = await ProductFlat.find({
        merchantId,
        isDeleted: { $ne: true }
      })
        .populate("brandId", "name")
        .populate("categoryId", "name")
        .populate("subCategoryId", "name")
        .populate("merchantId", "shopName email brandName")
        .sort({ createdAt: -1 });

      if (!flatProducts || flatProducts.length === 0) {
        return res.status(404).json({ message: "No products found for this merchant" });
      }

      // Group all flat products by styleGroupId to check if product is present in shop
      const styleGroups = {};
      flatProducts.forEach(p => {
        const sgId = p.styleGroupId || p._id.toString();
        if (!styleGroups[sgId]) styleGroups[sgId] = [];
        styleGroups[sgId].push(p);
      });

      // Keep products (style groups) that have at least one shop variant (or were created by merchant)
      const validFlatProducts = [];
      Object.values(styleGroups).forEach(groupDocs => {
        const hasShopVariant = groupDocs.some(p => p.source !== 'warehouse' && !p.warehouseId && !p.addedByOperator);
        if (hasShopVariant) {
          validFlatProducts.push(...groupDocs);
        }
      });

      if (validFlatProducts.length === 0) {
        return res.status(404).json({ message: "No products found for this merchant" });
      }

      // Group by styleGroupId + color.name
      const groups = {};
      validFlatProducts.forEach(p => {
        const colorName = p.color?.name || 'Default';
        const key = `${p.styleGroupId}_${colorName}`;
        if (!groups[key]) {
          groups[key] = {
            id: p.styleGroupId || p._id.toString(),
            styleGroupId: p.styleGroupId || p._id.toString(),
            name: p.name,
            productCode: p.productCode,
            source: p.source || 'shop',
            warehouseId: p.warehouseId || null,
            addedByOperator: p.addedByOperator || null,
            merchant: {
              id: p.merchantId?._id?.toString(),
              shopName: p.merchantId?.shopName || "",
              email: p.merchantId?.email || "",
            },
            brand: p.brandId?.name || "",
            category: p.categoryId?.name || "",
            subCategory: p.subCategoryId?.name || "",
            brandId: p.brandId?._id?.toString() || null,
            categoryId: p.categoryId?._id?.toString() || null,
            subCategoryId: p.subCategoryId?._id?.toString() || null,
            gender: p.gender,
            styleName: p.styleName || "",
            description: p.description,
            tags: p.tags,
            attributes: cleanAttributesHelper(p.attributes),
            features: p.features || {},
            isTriable: p.isTriable,
            ratings: p.ratings,
            numReviews: p.numReviews,
            isActive: p.isActive,
            color: p.color,
            mrp: p.mrp,
            price: p.price,
            discount: p.discount,
            images: p.images,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            sizes: []
          };
        }
        groups[key].sizes.push({
          _id: p._id.toString(),
          size: p.size,
          stock: p.stock,
          productCode: p.productCode
        });
      });

      const transformed = Object.values(groups);
      return res.status(200).json(transformed);
    }

    const products = await Product.find({
      merchantId,
      source: { $ne: 'warehouse' },
      warehouseId: null,
      addedByOperator: null,
      isDeleted: { $ne: true }
    })
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .populate("subCategoryId", "name")
      .populate("merchantId", "shopName email brandName")
      .sort({ createdAt: -1 });

    if (!products || products.length === 0) {
      console.log("No products found for this merchant");
      return res.status(404).json({ message: "No products found for this merchant" });
    }

    const transformed = products.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      styleName: p.styleName || "",
      productCode: p.productCode,
      merchant: {
        id: p.merchantId?._id?.toString(),
        shopName: p.merchantId?.shopName || "",
        email: p.merchantId?.email || "",
      },
      brand: p.brandId?.name || "",
      category: p.categoryId?.name || "",
      subCategory: p.subCategoryId?.name || "",
      brandId: p.brandId?._id?.toString() || null,
      categoryId: p.categoryId?._id?.toString() || null,
      subCategoryId: p.subCategoryId?._id?.toString() || null,
      gender: p.gender,
      description: p.description,
      tags: p.tags,
      attributes: cleanAttributesHelper(p.attributes),
      features: p.features || {},
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
    const results = await storageService.uploadMultiple(req.files || [], "products");
    const uploadedImages = results;

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const product = await ProductFlat.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      const results = await storageService.uploadMultiple(req.files || [], "products");
      product.images.push(...results);
      await product.save();
      return res.status(200).json({
        message: "✅ Images uploaded successfully",
        images: product.images
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

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const product = await ProductFlat.findOne({ 'images._id': imageId });
      if (!product) return res.status(404).json({ error: 'Image not found' });
      product.images = product.images.filter(img => img._id.toString() !== imageId);
      await product.save();
      return res.json({ message: 'Image deleted successfully' });
    }

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

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const deleted = await ProductFlat.findOneAndUpdate(
        { _id: productId, merchantId: req.merchantId },
        { isDeleted: true },
        { new: true }
      );
      return res.json({
        success: true,
        message: "Product deleted successfully",
        product: deleted,
      });
    }

    const deleted = await Product.findOneAndUpdate(
      { _id: productId, merchantId: req.merchantId },
      { isDeleted: true },
      { new: true }
    );

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

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, merchantId: req.merchantId });
      const targetColorVariants = allFlatVariants.filter(
        v => generateColorVariantId(productId, v.color.name) === variantId
      );

      if (targetColorVariants.length > 0) {
        const colorName = targetColorVariants[0].color.name;
        await ProductFlat.deleteMany({ styleGroupId: productId, "color.name": colorName, merchantId: req.merchantId });
      }

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.json({
        success: true,
        message: "Variant deleted successfully",
        product: makeFlatPayload(siblings),
      });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, merchantId: req.merchantId },
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

    const restrictedFields = ['_id', 'createdAt', 'updatedAt', 'variants', 'soldBy'];
    restrictedFields.forEach((field) => delete updateData[field]);

    if (updateData.merchantId) {
      const merchant = await Merchant.findById(updateData.merchantId);
      if (merchant) {
        updateData.soldBy = merchant.shopName || merchant.ownerName || "Default Store";
      }
    }

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const doc = await ProductFlat.findById(id);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      if (doc.source === 'warehouse' || doc.warehouseId || doc.addedByOperator) {
        return res.status(403).json({ success: false, message: 'Products stored in central warehouses cannot be edited directly by merchants.' });
      }

      const { sizes, ...sharedFields } = updateData;

      // Find all existing sizes for this color group
      const existingDocs = await ProductFlat.find({ 
        styleGroupId: doc.styleGroupId, 
        "color.name": doc.color.name,
        isDeleted: { $ne: true }
      });

      // 1. Delete sizes that are not in the incoming list
      const incomingIds = (sizes || []).map(s => s._id).filter(Boolean);
      for (const existing of existingDocs) {
        if (!incomingIds.includes(existing._id.toString())) {
          await ProductFlat.updateOne({ _id: existing._id }, { isDeleted: true });
        }
      }

      // 2. Add or update sizes
      if (sizes && Array.isArray(sizes)) {
        for (const sizeObj of sizes) {
          const cleanSize = sizeObj.size.replace(/\s+/g, '').toUpperCase();
          
          if (sizeObj._id) {
            const setFields = { 
              ...sharedFields,
              size: sizeObj.size,
              stock: Number(sizeObj.stock)
            };
            if (sizeObj.merchantSizeCode !== undefined) {
               setFields.merchantSizeCode = sizeObj.merchantSizeCode;
            }
            // Update existing size doc
            await ProductFlat.updateOne(
              { _id: sizeObj._id },
              { $set: setFields }
            );
          } else {
            // Create new size doc
            const base = doc.toObject();
            delete base._id;
            delete base.__v;
            delete base.createdAt;
            delete base.updatedAt;

            const parentProductCode = base.productCode.split('-')[0] || base.productCode;
            const cleanColor = base.color.name.replace(/\s+/g, '').toUpperCase();

            let productCode;
            if (sizeObj.merchantSizeCode) {
               const merchantPrefix = base.productCode.split('-').slice(0, 2).join('-');
               productCode = `${merchantPrefix}-${sizeObj.merchantSizeCode.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
            } else {
               productCode = `${parentProductCode}-${cleanColor}-${cleanSize}`;
            }

            const newSizeDoc = new ProductFlat({
              ...base,
              ...sharedFields,
              size: sizeObj.size,
              stock: Number(sizeObj.stock),
              merchantSizeCode: sizeObj.merchantSizeCode,
              productCode: productCode
            });
            await newSizeDoc.save();
          }
        }
      }

      // Update all remaining matching color docs for safety (e.g. if sizes array was empty/unmodified but shared fields changed)
      await ProductFlat.updateMany(
        { styleGroupId: doc.styleGroupId, "color.name": doc.color.name },
        { $set: sharedFields }
      );

      // Return one of the updated documents as sample
      const updatedSample = await ProductFlat.findById(id) || await ProductFlat.findOne({ styleGroupId: doc.styleGroupId, "color.name": doc.color.name });

      return res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        product: updatedSample,
      });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, merchantId: req.merchantId },
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

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, merchantId: req.merchantId });
      const targetColorVariants = allFlatVariants.filter(
        v => generateColorVariantId(productId, v.color.name) === variantId
      );
      if (!targetColorVariants.length) {
        return res.status(404).json({ success: false, message: 'Variant not found' });
      }

      if (targetColorVariants[0].source === 'warehouse' || targetColorVariants[0].warehouseId || targetColorVariants[0].addedByOperator) {
        return res.status(403).json({ success: false, message: 'Products stored in central warehouses cannot be edited directly by merchants.' });
      }

      const colorName = targetColorVariants[0].color.name;
      const restrictedFields = ['_id', 'createdAt', 'updatedAt', 'variants', 'soldBy'];
      restrictedFields.forEach((field) => delete updateData[field]);

      await ProductFlat.updateMany(
        { styleGroupId: productId, "color.name": colorName, merchantId: req.merchantId },
        { $set: updateData }
      );

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.status(200).json({
        success: true,
        message: 'Variant updated successfully',
        product: makeFlatPayload(siblings),
      });
    }

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

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, merchantId: req.merchantId });
      let targetColorVariants = allFlatVariants.filter(
        v => generateColorVariantId(productId, v.color?.name) === variantId || v._id?.toString() === variantId
      );

      if (targetColorVariants.length && (targetColorVariants[0].source === 'warehouse' || targetColorVariants[0].warehouseId || targetColorVariants[0].addedByOperator)) {
        return res.status(403).json({ success: false, message: 'Products stored in central warehouses cannot be edited directly by merchants.' });
      }

      const colorName = targetColorVariants.length ? targetColorVariants[0].color?.name : null;
      const query = colorName
        ? { styleGroupId: productId, "color.name": colorName, size: sizeName, merchantId: req.merchantId }
        : { styleGroupId: productId, size: sizeName, merchantId: req.merchantId };

      const updatedProduct = await ProductFlat.findOneAndUpdate(
        query,
        { $set: { stock } },
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ success: false, message: "Size variant not found" });
      }

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.status(200).json({
        success: true,
        message: `Stock updated for size '${sizeName}' in variant '${variantId}'`,
        product: makeFlatPayload(siblings),
      });
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

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, merchantId: req.merchantId });
      const targetColorVariants = allFlatVariants.filter(
        v => generateColorVariantId(productId, v.color.name) === variantId
      );
      if (!targetColorVariants.length) {
        return res.status(404).json({ success: false, message: "Product or variant not found" });
      }

      if (targetColorVariants[0].source === 'warehouse' || targetColorVariants[0].warehouseId || targetColorVariants[0].addedByOperator) {
        return res.status(403).json({ success: false, message: 'Products stored in central warehouses cannot be edited directly by merchants.' });
      }

      const baseVariantDoc = targetColorVariants[0];
      const colorName = baseVariantDoc.color.name;
      const incomingSizeNames = sizes.map((s) => s.size);

      for (const sizeObj of sizes) {
        if (!sizeObj.size || sizeObj.stock === undefined) continue;

        const existingSizeDoc = targetColorVariants.find(v => v.size === sizeObj.size);
        if (existingSizeDoc) {
          const updateData = { stock: sizeObj.stock };
          if (sizeObj.merchantSizeCode !== undefined) {
             updateData.merchantSizeCode = sizeObj.merchantSizeCode;
          }
          await ProductFlat.updateOne({ _id: existingSizeDoc._id }, { $set: updateData });
        } else {
          const base = baseVariantDoc.toObject();
          delete base._id;
          delete base.__v;
          delete base.createdAt;
          delete base.updatedAt;

          const parentProductCode = base.productCode.split('-')[0] || base.productCode;
          const cleanColor = base.color.name.replace(/\s+/g, '').toUpperCase();
          const cleanSize = sizeObj.size.replace(/\s+/g, '').toUpperCase();

          let productCode;
          if (sizeObj.merchantSizeCode) {
             const merchantPrefix = base.productCode.split('-').slice(0, 2).join('-');
             productCode = `${merchantPrefix}-${sizeObj.merchantSizeCode.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
          } else {
             productCode = `${parentProductCode}-${cleanColor}-${cleanSize}`;
          }

          const newSizeDoc = new ProductFlat({
            ...base,
            size: sizeObj.size,
            stock: sizeObj.stock,
            merchantSizeCode: sizeObj.merchantSizeCode,
            productCode: productCode
          });
          await newSizeDoc.save();
        }
      }

      await ProductFlat.deleteMany({
        styleGroupId: productId,
        "color.name": colorName,
        size: { $nin: incomingSizeNames },
        merchantId: req.merchantId
      });

      const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
      return res.status(200).json({
        success: true,
        message: "Sizes updated successfully (added, updated, and removed as needed)",
        product: makeFlatPayload(siblings),
      });
    }

    const product = await Product.findOne({ _id: productId, "variants._id": variantId });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product or variant not found" });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    const incomingSizeNames = sizes.map((s) => s.size);

    sizes.forEach(({ size, stock, merchantSizeCode }) => {
      if (!size || stock === undefined) return;

      const existingSize = variant.sizes.find((s) => s.size === size);
      if (existingSize) {
        existingSize.stock = stock;
        if (merchantSizeCode !== undefined) existingSize.merchantSizeCode = merchantSizeCode;
      } else {
        variant.sizes.push({ size, stock, merchantSizeCode });
      }
    });

    variant.sizes = variant.sizes.filter((s) => incomingSizeNames.includes(s.size));

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

export const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ isActive: true })
    res.status(200).json({
      success: true,
      message: "All brands",
      brands
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while getting brands",
      error: error.message
    })
  }
}

export const bulkUploadProducts = async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: "No products provided for upload" });
    }

    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    const brandName = merchant.shopName || merchant.ownerName || "Default Brand";
    const soldBy = merchant.shopName || merchant.ownerName || "Default Store";

    // Auto find or create brand
    let brand = await Brand.findOne({ name: brandName, createdById: merchant._id });
    if (!brand) {
      brand = await Brand.create({
        name: brandName,
        createdByType: 'Merchant',
        createdById: merchant._id,
      });
    }

    const createdProducts = [];
    const errors = [];

    for (let index = 0; index < products.length; index++) {
      const p = products[index];
      try {
        // Find category
        if (!p.categoryName) {
          throw new Error(`Category Name is required at product index ${index}`);
        }
        const category = await Category.findOne({
          name: { $regex: new RegExp("^" + p.categoryName.trim() + "$", "i") },
          level: 0,
          isActive: true
        });
        if (!category) {
          throw new Error(`Category '${p.categoryName}' not found`);
        }

        let subCategoryId = undefined;
        if (p.subCategoryName) {
          const subCategory = await Category.findOne({
            name: { $regex: new RegExp("^" + p.subCategoryName.trim() + "$", "i") },
            level: 1,
            parentId: category._id,
            isActive: true
          });
          if (!subCategory) {
            throw new Error(`Subcategory '${p.subCategoryName}' not found in category '${p.categoryName}'`);
          }
          subCategoryId = subCategory._id;
        }

        // Validate gender vs category allowedGenders
        const leafCategoryId = subCategoryId || category._id;
        const leafCategory = await Category.findById(leafCategoryId).lean();
        if (leafCategory && leafCategory.allowedGenders) {
          const isValidGender = p.gender.every(g => leafCategory.allowedGenders.includes(g));
          if (!isValidGender) {
            throw new Error(`Invalid gender for category. Allowed: ${leafCategory.allowedGenders.join(', ')}`);
          }
        }

        // Parse variants: we map mrp, price, discount and group sizes
        const variants = (p.variants || []).map(v => {
          const mrp = isNaN(Number(v.mrp)) ? 0 : Number(v.mrp);
          const price = isNaN(Number(v.price)) ? 0 : Number(v.price);
          const discount = isNaN(Number(v.discount)) ? 0 : Number(v.discount);

          const sizes = (v.sizes || []).map(s => ({
            size: s.size,
            stock: isNaN(Number(s.stock)) ? 0 : Number(s.stock)
          }));

          return {
            color: v.color || { name: "Default", hex: "#CCCCCC" },
            mrp,
            price,
            discount,
            sizes,
            images: []
          };
        });

        const product = new Product({
          name: p.name,
          merchantId: req.merchantId,
          brandId: brand._id,
          categoryId: category._id,
          subCategoryId,
          gender: p.gender,
          soldBy: p.soldBy || soldBy,
          styleName: p.styleName || "",
          description: p.description || "",
          tags: p.tags || [],
          isTriable: p.isTriable !== undefined ? p.isTriable : true,
          isActive: p.isActive !== undefined ? p.isActive : true,
          variants
        });

        await product.save();
        createdProducts.push(product);
      } catch (err) {
        errors.push({ name: p.name || `Product at index ${index}`, error: err.message });
      }
    }

    if (createdProducts.length === 0 && errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to upload any products",
        errors
      });
    }

    return res.status(201).json({
      success: true,
      message: `Successfully uploaded ${createdProducts.length} product(s).`,
      count: createdProducts.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Bulk upload controller error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during bulk upload",
      error: error.message
    });
  }
};

export const createProductFull = async (req, res) => {
  try {
    let { 
      name, description, styleName, categoryId, subCategoryId, gender, 
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

    if (!name || !categoryId || !subCategoryId || !variants.length) {
      return res.status(400).json({ success: false, message: "Missing required fields or variants" });
    }

    const merchantId = req.merchantId;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ success: false, message: "Merchant not found" });

    const cleanShop = merchant.shopName ? merchant.shopName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() : "SH";
    const last4 = merchant._id.toString().slice(-4).toUpperCase();
    const merchantPrefix = `${cleanShop}-${last4}`;

    // Resolve or auto-create brand for the merchant (optional)
    let brandId = undefined;
    let brandPrefix = "FFF";
    try {
      const brandName = merchant.shopName || merchant.ownerName || "Default Brand";
      let brand = await Brand.findOne({ name: brandName, createdById: merchant._id });
      if (!brand && merchant.brandId) {
        brand = await Brand.findById(merchant.brandId);
      }
      if (!brand) {
        brand = await Brand.create({
          name: brandName,
          createdByType: 'Merchant',
          createdById: merchant._id,
        });
      }
      if (brand) {
        brandId = brand._id;
        brandPrefix = brand.name.slice(0, 3).toUpperCase();
      }
    } catch (brandErr) {
      console.error("Optional brand resolution failed:", brandErr);
    }

    const category = await Category.findById(categoryId);
    const catPrefix = category ? category.name.slice(0, 2).toUpperCase() : "GP";
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const baseProductCode = `${merchantPrefix}-${brandPrefix}-${catPrefix}-${randPart}`;

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      let styleGroupId = req.body.styleGroupId;
      if (!styleGroupId && req.body.selectedBaseProductId) {
        const parentDoc = await ProductFlat.findById(req.body.selectedBaseProductId);
        if (parentDoc) {
          styleGroupId = parentDoc.styleGroupId;
        }
      }
      if (!styleGroupId) {
        styleGroupId = new mongoose.Types.ObjectId().toString();
      }

      const createdDocs = [];
      for (const variant of variants) {
        const cleanColor = variant.color.name.replace(/\s+/g, '').toUpperCase();
        
        const finalImages = [];
        if (variant.imageFields && Array.isArray(variant.imageFields)) {
          for (const field of variant.imageFields) {
            const file = req.files.find(f => f.fieldname === field);
            if (file) {
              const uploadRes = await storageService.uploadSingle(file, "products");
              if (uploadRes) finalImages.push(uploadRes);
            }
          }
        }

        for (const sizeInfo of variant.sizes) {
          const cleanSize = sizeInfo.size.replace(/\s+/g, '').toUpperCase();
          let productCode;
          let baseSku = sizeInfo.merchantSizeCode || variant.productSku;
          if (baseSku) {
            productCode = `${merchantPrefix}-${baseSku.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
          } else {
            productCode = `${baseProductCode}-${cleanColor}-${cleanSize}`;
          }

          const newDoc = new ProductFlat({
            styleGroupId,
            name,
            description,
            styleName,
            categoryId,
            subCategoryId,
            brandId,
            merchantId,
            gender,
            attributes,
            tags,
            collectionIds,
            isTriable: req.body.isTriable === 'true' || req.body.isTriable === true,
            isActive: false, // Default false until approved
            productCode,
            color: variant.color,
            size: sizeInfo.size,
            merchantSizeCode: sizeInfo.merchantSizeCode,
            stock: isNaN(Number(sizeInfo.stock)) ? 0 : Number(sizeInfo.stock),
            mrp: isNaN(Number(variant.mrp)) ? 0 : Number(variant.mrp),
            price: isNaN(Number(variant.price)) ? 0 : Number(variant.price),
            discount: isNaN(Number(variant.discount)) ? 0 : Number(variant.discount),
            images: finalImages,
          });

          await newDoc.save();
          createdDocs.push(newDoc);
        }
      }
      return res.status(201).json({ 
        success: true, 
        message: "Product created with variants successfully", 
        productId: baseProductCode 
      });
    } else {
      const legacyVariants = [];
      for (let vIdx = 0; vIdx < variants.length; vIdx++) {
        const variant = variants[vIdx];
        const cleanColor = variant.color.name.replace(/\s+/g, '').toUpperCase();

        const finalImages = [];
        if (variant.imageFields && Array.isArray(variant.imageFields)) {
          for (const field of variant.imageFields) {
            const file = req.files.find(f => f.fieldname === field);
            if (file) {
              const uploadRes = await storageService.uploadSingle(file, "products");
              if (uploadRes) finalImages.push(uploadRes);
            }
          }
        }

        const sizeStockList = variant.sizes.map(s => ({
          size: s.size,
          merchantSizeCode: s.merchantSizeCode,
          stock: isNaN(Number(s.stock)) ? 0 : Number(s.stock)
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

      const newProduct = new Product({
        name,
        description,
        styleName,
        categoryId,
        subCategoryId,
        brandId,
        merchantId,
        gender,
        attributes,
        tags,
        collectionIds,
        isTriable: req.body.isTriable === 'true' || req.body.isTriable === true,
        isActive: false,
        variants: legacyVariants,
      });

      await newProduct.save();
      return res.status(201).json({ 
        success: true, 
        message: "Product created successfully", 
        product: newProduct 
      });
    }
  } catch (err) {
    console.error("Create product full error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const searchBaseProducts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(200).json({ success: true, products: [] });
    }

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const match = { isDeleted: { $ne: true } };
      match.$or = [
        { name: { $regex: query, $options: "i" } },
        { styleName: { $regex: query, $options: "i" } },
        { tags: { $in: [new RegExp(query, "i")] } }
      ];

      const products = await ProductFlat.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$styleGroupId",
            name: { $first: "$name" },
            styleName: { $first: "$styleName" },
            description: { $first: "$description" },
            categoryId: { $first: "$categoryId" },
            subCategoryId: { $first: "$subCategoryId" },
            brandId: { $first: "$brandId" },
            gender: { $first: "$gender" },
            attributes: { $first: "$attributes" },
            tags: { $first: "$tags" },
            collectionIds: { $first: "$collectionIds" },
            isTriable: { $first: "$isTriable" },
          }
        },
        { $limit: 10 }
      ]);

      const populatedProducts = [];
      for (const p of products) {
        const cat = p.categoryId ? await Category.findById(p.categoryId).select('name').lean() : null;
        const brand = p.brandId ? await Brand.findById(p.brandId).select('name logo').lean() : null;
        populatedProducts.push({
          ...p,
          categoryName: cat ? cat.name : '',
          brandName: brand ? brand.name : ''
        });
      }

      return res.status(200).json({ success: true, products: populatedProducts });
    } else {
      const queryObj = { isDeleted: { $ne: true } };
      queryObj.$or = [
        { name: { $regex: query, $options: "i" } },
        { styleName: { $regex: query, $options: "i" } },
        { tags: { $in: [new RegExp(query, "i")] } }
      ];

      const products = await Product.find(queryObj)
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .limit(10)
        .lean();

      const mappedProducts = products.map(p => ({
        _id: p._id,
        name: p.name,
        styleName: p.styleName,
        description: p.description,
        categoryId: p.categoryId?._id || p.categoryId,
        categoryName: p.categoryId?.name || '',
        subCategoryId: p.subCategoryId,
        brandId: p.brandId?._id || p.brandId,
        brandName: p.brandId?.name || '',
        gender: p.gender,
        attributes: p.attributes,
        tags: p.tags,
        collectionIds: p.collectionIds,
        isTriable: p.isTriable,
      }));

      return res.status(200).json({ success: true, products: mappedProducts });
    }
  } catch (error) {
    console.error("Search base products error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateMatchingProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { matchingProducts } = req.body; // Array of styleGroupIds
    const merchantId = req.merchantId;

    if (!Array.isArray(matchingProducts)) {
      return res.status(400).json({ message: "matchingProducts must be an array of strings" });
    }
    
    // Check limit
    if (matchingProducts.length > 3) {
      return res.status(400).json({ message: "You can only select up to 3 matching products." });
    }

    if (process.env.USE_FLAT_PRODUCT_SCHEMA === 'true') {
      const ProductFlat = (await import('../../models/productFlat.model.js')).default;
      
      // Verify ownership
      const product = await ProductFlat.findOne({ styleGroupId: productId, merchantId });
      if (!product) {
        // Fallback: check if the productId is actually an _id and it belongs to merchant
        const productById = await ProductFlat.findOne({ _id: productId, merchantId });
        if (!productById) {
          return res.status(404).json({ message: "Product not found or not owned by you" });
        }
        await ProductFlat.updateMany(
          { styleGroupId: productById.styleGroupId, merchantId },
          { $set: { matchingProducts } }
        );
      } else {
        await ProductFlat.updateMany(
          { styleGroupId: productId, merchantId },
          { $set: { matchingProducts } }
        );
      }
      return res.status(200).json({ message: "Matching products updated successfully" });
    } else {
      return res.status(400).json({ message: "Only flat schema is supported for this operation." });
    }
  } catch (error) {
    console.error("Error in updateMatchingProducts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



