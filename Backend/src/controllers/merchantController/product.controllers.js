import mongoose from "mongoose";
import Category from '../../models/category.model.js';
import { productSchema } from '../../utils/validators/product.validator.js';
import Brand from "../../models/brand.model.js";
import Merchant from "../../models/merchant.model.js";
import { storageService } from '../../services/storage.service.js';
import ProductFlat from '../../models/productFlat.model.js';
import crypto from 'crypto';
import { analyzeProductImage } from '../../services/geminiProductAnalyzer.js';
import { generateColorVariantId } from '../../utils/variantAdapter.js';
import { resolveCategoryHierarchy } from '../../helperFns/categoryHelper.js';
import { buildFlexibleSearchRegex } from '../../helperFns/searchHelper.js';

const safeParse = (value) => {
  if (!value) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

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
 * Helper to build product ownership query condition or verify authorization
 * for merchants, warehouse operators, and admins.
 */
export const getProductOwnerCondition = async (req) => {
  if (req.admin) return {};
  if (!req.merchantId) return { _id: null };

  const caller = await Merchant.findById(req.merchantId);
  const isWarehouse = caller && caller.accountType === 'warehouse' && caller.warehouseId;
  if (isWarehouse) {
    const assignedMerchants = await Merchant.find({
      assignedWarehouseIds: caller.warehouseId
    }).select('_id').lean();
    const assignedMerchantIds = assignedMerchants.map((m) => m._id);

    return {
      $or: [
        { warehouseId: caller.warehouseId },
        { addedByOperator: caller._id },
        { merchantId: { $in: [req.merchantId, ...assignedMerchantIds] } }
      ]
    };
  }
  return { merchantId: req.merchantId };
};

export const verifyProductAuthorization = async (doc, req) => {
  if (req.admin) return true;
  if (!req.merchantId || !doc) return false;

  const callerIdStr = req.merchantId.toString();

  // 1. Direct owner check
  if (doc.merchantId && doc.merchantId.toString() === callerIdStr) {
    return true;
  }

  // 2. Check if caller is warehouse operator
  const caller = await Merchant.findById(req.merchantId);
  const isWarehouse = caller && caller.accountType === 'warehouse' && caller.warehouseId;
  if (isWarehouse) {
    const operatorWhIdStr = caller.warehouseId.toString();
    // 2a. Warehouse product stored in caller's warehouse
    if (doc.warehouseId && doc.warehouseId.toString() === operatorWhIdStr) {
      return true;
    }
    // 2b. Product added by this warehouse operator
    if (doc.addedByOperator && doc.addedByOperator.toString() === callerIdStr) {
      return true;
    }
    // 2c. Product belongs to a merchant assigned to caller's warehouse
    if (doc.merchantId) {
      const isAssigned = await Merchant.exists({
        _id: doc.merchantId,
        assignedWarehouseIds: caller.warehouseId
      });
      if (isAssigned) return true;
    }
  }

  return false;
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
      if (img.url && img.url.startsWith("http")) {
        finalImages.push({ public_id: img.public_id, url: img.url });
      } else if (img.url && img.url.startsWith("blob")) {
        const file = req.files[fileIndex];
        if (file) {
          const result = await storageService.uploadSingle(file, "products");
          if (result) finalImages.push(result);
        }
        fileIndex++;
      }
    }

    if (req.files && Array.isArray(req.files) && req.files.length > 0 && fileIndex === 0) {
      for (const file of req.files) {
        const result = await storageService.uploadSingle(file, "products");
        if (result) finalImages.push(result);
      }
    }

      const ownerCondition = await getProductOwnerCondition(req);
      const existingFlatProduct = await ProductFlat.findOne({ styleGroupId: productId, ...ownerCondition });
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

      const parsedSizes = parseJSON(req.body.sizes);
      const ownerCondition = await getProductOwnerCondition(req);
      const variantFilter = { styleGroupId: productId, ...ownerCondition };
      const allFlatVariants = await ProductFlat.find(variantFilter);
      const targetColorVariants = allFlatVariants.filter(
        v => generateColorVariantId(productId, v.color?.name || v.color) === variantId || v._id?.toString() === variantId
      );
      if (!targetColorVariants.length) {
        return res.status(404).json({ message: "Product or variant not found" });
      }

      const effectiveMerchantId = req.admin ? targetColorVariants[0].merchantId : req.merchantId;
      const merchant = effectiveMerchantId ? await Merchant.findById(effectiveMerchantId) : null;

      const cleanShop = merchant?.shopName ? merchant.shopName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() : "SH";
      const last4 = merchant?._id ? merchant._id.toString().slice(-4).toUpperCase() : "0000";
      const merchantPrefix = `${cleanShop}-${last4}`;

      const oldColorName = targetColorVariants[0].color?.name || targetColorVariants[0].color;
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

      if (req.files && Array.isArray(req.files) && req.files.length > 0 && fileIndex === 0) {
        for (const file of req.files) {
          if (finalImages.length < MAX_IMAGES) {
            const result = await storageService.uploadSingle(file, "products");
            if (result) finalImages.push(result);
          }
        }
      }

      for (const img of deletedImages) {
        if (img.public_id) {
          await storageService.deleteFile(img.public_id);
        }
      }

      // If sizes array provided, sync sizes and stock
      if (Array.isArray(parsedSizes) && parsedSizes.length > 0) {
        const baseVariantDoc = targetColorVariants[0];
        const incomingSizeNames = parsedSizes.map((s) => s.size);

        for (const sizeObj of parsedSizes) {
          if (!sizeObj.size || sizeObj.stock === undefined) continue;
          const existingSizeDoc = targetColorVariants.find(v => v.size === sizeObj.size);

          if (existingSizeDoc) {
            const updateFields = {
              stock: Number(sizeObj.stock) || 0,
              color: parsedColor,
              mrp: safeMrp,
              price: safePrice,
              discount: safeDiscount,
              images: finalImages
            };
            if (sizeObj.merchantSizeCode !== undefined) {
              updateFields.merchantSizeCode = sizeObj.merchantSizeCode;
            }
            await ProductFlat.updateOne({ _id: existingSizeDoc._id }, { $set: updateFields });
          } else {
            const base = baseVariantDoc.toObject();
            delete base._id;
            delete base.__v;
            delete base.createdAt;
            delete base.updatedAt;

            const parentProductCode = base.productCode?.split('-')[0] || base.productCode || 'PRD';
            const cleanColor = (parsedColor?.name || 'DEFAULT').replace(/\s+/g, '').toUpperCase();
            const cleanSize = (sizeObj.size || '').replace(/\s+/g, '').toUpperCase();

            let productCode;
            if (sizeObj.merchantSizeCode) {
              const mPrefix = base.productCode?.split('-').slice(0, 2).join('-') || merchantPrefix;
              productCode = `${mPrefix}-${sizeObj.merchantSizeCode.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
            } else {
              productCode = `${parentProductCode}-${cleanColor}-${cleanSize}-${Date.now().toString(36).toUpperCase()}`;
            }

            const newSizeDoc = new ProductFlat({
              ...base,
              color: parsedColor,
              mrp: safeMrp,
              price: safePrice,
              discount: safeDiscount,
              images: finalImages,
              size: sizeObj.size,
              stock: Number(sizeObj.stock) || 0,
              merchantSizeCode: sizeObj.merchantSizeCode,
              productCode: productCode
            });
            await newSizeDoc.save();
          }
        }

        const deleteCondition = {
          styleGroupId: productId,
          "color.name": oldColorName,
          size: { $nin: incomingSizeNames },
          ...ownerCondition
        };
        await ProductFlat.deleteMany(deleteCondition);
      } else {
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
    const safeStock = isNaN(Number(stock)) ? 0 : Math.max(0, Number(stock));

    let ownerCondition = {};
    if (!req.admin) {
      const merchant = await Merchant.findById(req.merchantId);
      const isWarehouse = merchant && merchant.accountType === 'warehouse' && merchant.warehouseId;
      ownerCondition = isWarehouse
        ? { warehouseId: merchant.warehouseId, source: 'warehouse' }
        : { merchantId: req.merchantId };
    }

    let updatedFlatDoc = null;

    if (sizeId) {
      const isObjId = mongoose.Types.ObjectId.isValid(sizeId);
      const query = isObjId
        ? { _id: sizeId, ...ownerCondition }
        : {
            $or: [{ styleGroupId: productId }, { _id: productId }],
            size: new RegExp(`^${String(sizeId).trim()}$`, 'i'),
            ...ownerCondition
          };

      updatedFlatDoc = await ProductFlat.findOneAndUpdate(
        query,
        { $set: { stock: safeStock } },
        { new: true }
      );

      // Fallback: if isObjId was true but not found by _id, try finding by size name or styleGroupId
      if (!updatedFlatDoc) {
        const fallbackQuery = {
          $or: [
            { styleGroupId: productId, size: size ? new RegExp(`^${String(size).trim()}$`, 'i') : new RegExp(`^${String(sizeId).trim()}$`, 'i') },
            { _id: productId, size: size ? new RegExp(`^${String(size).trim()}$`, 'i') : new RegExp(`^${String(sizeId).trim()}$`, 'i') }
          ],
          ...ownerCondition
        };
        updatedFlatDoc = await ProductFlat.findOneAndUpdate(
          fallbackQuery,
          { $set: { stock: safeStock } },
          { new: true }
        );
      }
    } else {
      const allFlatVariants = await ProductFlat.find({ styleGroupId: productId, ...ownerCondition });
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

    const targetStyleGroupId = updatedFlatDoc.styleGroupId || productId;
    const siblings = await ProductFlat.find({ styleGroupId: targetStyleGroupId, isDeleted: { $ne: true } });
    return res.json({
      success: true,
      message: sizeId ? "Stock updated successfully" : "New size added",
      product: makeFlatPayload(siblings)
    });
  } catch (err) {
    console.error("Error updating stock:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

export const updateStockBatch = async (req, res) => {
  try {
    const rawUpdates = req.body.updates || req.body.sizes || [];
    if (!Array.isArray(rawUpdates) || rawUpdates.length === 0) {
      return res.status(400).json({ success: false, message: "Updates array is required" });
    }

    let ownerCondition = {};
    if (!req.admin) {
      const merchant = await Merchant.findById(req.merchantId);
      const isWarehouse = merchant && merchant.accountType === 'warehouse' && merchant.warehouseId;
      ownerCondition = isWarehouse
        ? { warehouseId: merchant.warehouseId, source: 'warehouse' }
        : { merchantId: req.merchantId };
    }

    const bulkOps = [];
    for (const item of rawUpdates) {
      const sizeId = item.sizeId || item._id || item.size;
      const safeStock = isNaN(Number(item.stock)) ? 0 : Math.max(0, Number(item.stock));
      const productId = item.productId || item.styleGroupId;

      if (!sizeId) continue;

      const isObjId = mongoose.Types.ObjectId.isValid(sizeId);
      const filter = isObjId
        ? { _id: sizeId, ...ownerCondition }
        : {
            $or: [{ styleGroupId: productId }, { _id: productId }],
            size: new RegExp(`^${String(sizeId).trim()}$`, 'i'),
            ...ownerCondition
          };

      bulkOps.push({
        updateOne: {
          filter,
          update: { $set: { stock: safeStock } }
        }
      });
    }

    if (bulkOps.length === 0) {
      return res.status(400).json({ success: false, message: "No valid stock updates to apply" });
    }

    const result = await ProductFlat.bulkWrite(bulkOps);
    return res.status(200).json({
      success: true,
      message: `Stock updated successfully for ${result.modifiedCount || bulkOps.length} size(s)`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("Error in updateStockBatch:", err);
    res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  }
};

export const updateSizeCount = async (req, res) => {
  try {
    const { productId, variantId, sizeId } = req.params;
    const { stock } = req.body;

    if (!sizeId) {
      return res.status(400).json({ message: "Size ID is required for stock updates" });
    }
    const safeStock = isNaN(Number(stock)) ? 0 : Math.max(0, Number(stock));

    let ownerCondition = {};
    if (!req.admin) {
      const merchant = await Merchant.findById(req.merchantId);
      const isWarehouse = merchant && merchant.accountType === 'warehouse' && merchant.warehouseId;
      ownerCondition = isWarehouse
        ? { warehouseId: merchant.warehouseId, source: 'warehouse' }
        : { merchantId: req.merchantId };
    }

    const query = { _id: sizeId, ...ownerCondition };

    const updatedFlatDoc = await ProductFlat.findOneAndUpdate(
      query,
      { $set: { stock: safeStock } },
      { new: true }
    );
    if (!updatedFlatDoc) {
      return res.status(404).json({ message: "Product, variant, or size not found" });
    }

    const targetStyleGroupId = updatedFlatDoc.styleGroupId || productId;
    const siblings = await ProductFlat.find({ styleGroupId: targetStyleGroupId, isDeleted: { $ne: true } });
    return res.json({
      success: true,
      message: "Stock updated successfully",
      product: makeFlatPayload(siblings)
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

    const incomingColor = req.body.color?.name || req.body.color || req.body.colorName;
    const incomingStyleGroupId = req.body.styleGroupId;

    let targetStyleGroupId = productId;
    let baseDoc = null;

    // 1. Try finding by ObjectId if productId is valid ObjectId
    if (mongoose.Types.ObjectId.isValid(productId)) {
      baseDoc = await ProductFlat.findById(productId);
    }
    // 2. Try finding by styleGroupId
    if (!baseDoc) {
      baseDoc = await ProductFlat.findOne({ styleGroupId: productId });
    }
    // 3. Try finding by variantId if variantId is a valid ObjectId
    if (!baseDoc && mongoose.Types.ObjectId.isValid(variantId)) {
      baseDoc = await ProductFlat.findById(variantId);
    }
    // 4. Try incomingStyleGroupId from body
    if (!baseDoc && incomingStyleGroupId) {
      if (mongoose.Types.ObjectId.isValid(incomingStyleGroupId)) {
        baseDoc = await ProductFlat.findById(incomingStyleGroupId);
      }
      if (!baseDoc) {
        baseDoc = await ProductFlat.findOne({ styleGroupId: incomingStyleGroupId });
      }
    }

    if (baseDoc && baseDoc.styleGroupId) {
      targetStyleGroupId = baseDoc.styleGroupId;
    }

    // Permission check for merchant/warehouse
    if (!req.admin && req.merchantId) {
      if (baseDoc) {
        const isOwner = await verifyProductAuthorization(baseDoc, req);
        if (!isOwner) {
          return res.status(403).json({ message: "You are not authorized to update this product's price." });
        }
      }
    }

    // Find all flat variants under targetStyleGroupId or by productId or baseDoc's styleGroupId
    const queryConditions = [{ styleGroupId: targetStyleGroupId }];
    if (productId && productId !== targetStyleGroupId) {
      queryConditions.push({ styleGroupId: productId });
    }
    if (baseDoc?._id) {
      queryConditions.push({ _id: baseDoc._id });
    }
    if (mongoose.Types.ObjectId.isValid(productId)) {
      queryConditions.push({ _id: productId });
    }

    let allFlatVariants = await ProductFlat.find({ $or: queryConditions });

    if (!allFlatVariants.length && mongoose.Types.ObjectId.isValid(variantId)) {
      const byVar = await ProductFlat.findById(variantId);
      if (byVar) {
        targetStyleGroupId = byVar.styleGroupId || byVar._id.toString();
        allFlatVariants = await ProductFlat.find({
          $or: [
            { styleGroupId: targetStyleGroupId },
            { _id: byVar._id }
          ]
        });
      }
    }

    if (!allFlatVariants.length) {
      return res.status(404).json({ message: "Product or variant not found" });
    }

    // Filter matching variants for the target color
    let targetColorVariants = allFlatVariants.filter((v) => {
      const vColorName = (v.color?.name || v.color || '').toString().trim().toLowerCase();
      const inColorName = incomingColor ? incomingColor.toString().trim().toLowerCase() : '';

      // Match by exact _id
      if (variantId && v._id?.toString() === variantId.toString()) return true;

      // Match by generateColorVariantId with targetStyleGroupId or productId
      if (targetStyleGroupId && generateColorVariantId(targetStyleGroupId, v.color?.name || v.color) === variantId) return true;
      if (productId && generateColorVariantId(productId, v.color?.name || v.color) === variantId) return true;

      // Match by incoming color name from body
      if (inColorName && vColorName === inColorName) return true;

      // Match by variantId being the color name
      if (variantId && vColorName === variantId.toString().trim().toLowerCase()) return true;

      return false;
    });

    // Fallbacks if not matched by ID/hash
    if (!targetColorVariants.length) {
      if (variantId === 'default_var' || String(variantId).startsWith('var_') || !variantId) {
        targetColorVariants = allFlatVariants;
      } else if (incomingColor) {
        const inColorLower = incomingColor.toString().trim().toLowerCase();
        targetColorVariants = allFlatVariants.filter(
          (v) => (v.color?.name || v.color || '').toString().trim().toLowerCase() === inColorLower
        );
      } else if (baseDoc) {
        const baseColor = (baseDoc.color?.name || baseDoc.color || '').toString().trim().toLowerCase();
        targetColorVariants = allFlatVariants.filter(
          (v) => (v.color?.name || v.color || '').toString().trim().toLowerCase() === baseColor
        );
      } else {
        // If still empty but we have variants, match the first variant group
        targetColorVariants = [allFlatVariants[0]];
      }
    }

    if (!targetColorVariants.length) {
      return res.status(404).json({ message: "Product or variant not found" });
    }

    const targetDocIds = targetColorVariants.map((v) => v._id);
    const colorName = targetColorVariants[0].color?.name || targetColorVariants[0].color || 'Default';

    // Update by exact IDs
    await ProductFlat.updateMany(
      { _id: { $in: targetDocIds } },
      { $set: { mrp: safeMRP, price: safePrice, discount: safeDiscount } }
    );

    // Also update any other docs of the same styleGroupId and color name to keep sizes synchronized
    if (targetStyleGroupId && colorName) {
      await ProductFlat.updateMany(
        {
          styleGroupId: targetStyleGroupId,
          $or: [{ "color.name": colorName }, { color: colorName }]
        },
        { $set: { mrp: safeMRP, price: safePrice, discount: safeDiscount } }
      );
    }

    const siblings = await ProductFlat.find({
      $or: [{ styleGroupId: targetStyleGroupId }, { _id: { $in: targetDocIds } }],
      isActive: true
    });

    return res.json({
      success: true,
      message: "Price updated successfully",
      product: makeFlatPayload(siblings, { addedColorName: colorName })
    });
  } catch (err) {
    console.error("Error updating price:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

export const deleteVariantSizes = async (req, res) => {
  try {
    const ownerCondition = await getProductOwnerCondition(req);
    const deleteQuery = { _id: sizeId, styleGroupId: productId, ...ownerCondition };

    await ProductFlat.deleteOne(deleteQuery);
    const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
    return res.json({
      message: "Size deleted successfully",
      product: makeFlatPayload(siblings)
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
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

export const getBaseProducts = async (req, res) => {
  try {
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
    let doc = null;

    // 1. Try finding ProductFlat by _id if valid ObjectId
    if (mongoose.Types.ObjectId.isValid(productId)) {
      doc = await ProductFlat.findById(productId)
        .populate('brandId', 'name')
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('additionalCategoryIds', 'name parentId level')
        .populate('merchantId', 'name shopName email')
        .populate('attributes.attributeId', 'name slug inputType values');
    }

    // 2. If not found by _id, try finding ProductFlat by styleGroupId
    if (!doc) {
      doc = await ProductFlat.findOne({ styleGroupId: productId, isDeleted: { $ne: true } })
        .populate('brandId', 'name')
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('additionalCategoryIds', 'name parentId level')
        .populate('merchantId', 'name shopName email')
        .populate('attributes.attributeId', 'name slug inputType values');
    }

    // 3. Fallback without isDeleted or by productCode
    if (!doc) {
      doc = await ProductFlat.findOne({ productCode: productId })
        .populate('brandId', 'name')
        .populate('categoryId', 'name')
        .populate('subCategoryId', 'name')
        .populate('merchantId', 'name shopName email')
        .populate('attributes.attributeId', 'name slug inputType values');
    }

    if (!doc) {
      return res.status(404).json({ message: "Product not found" });
    }

    const siblings = await ProductFlat.find({ 
      styleGroupId: doc.styleGroupId, 
      "color.name": doc.color?.name || "Default",
      isDeleted: { $ne: true }
    }).populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('additionalCategoryIds', 'name parentId level')
      .populate('merchantId', 'name shopName email')
      .populate('attributes.attributeId', 'name slug inputType values');

    const allVariantsDocs = await ProductFlat.find({
      styleGroupId: doc.styleGroupId,
      isDeleted: { $ne: true }
    }).populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('merchantId', 'name shopName email');

    const colorGroups = {};
    allVariantsDocs.forEach(s => {
      const cName = s.color?.name || "Default";
      if (!colorGroups[cName]) {
        colorGroups[cName] = {
          _id: s._id.toString(),
          color: s.color || { name: "Default", hex: "" },
          mrp: s.mrp,
          price: s.price,
          discount: s.discount,
          images: s.images || [],
          sizes: []
        };
      }
      colorGroups[cName].sizes.push({
        _id: s._id.toString(),
        size: s.size,
        merchantSizeCode: s.merchantSizeCode,
        stock: s.stock,
        productCode: s.productCode
      });
    });

    let resolvedCatName = typeof doc.categoryId === 'object' && doc.categoryId ? doc.categoryId.name : (doc.category || "");
    let resolvedCatId = typeof doc.categoryId === 'object' && doc.categoryId ? doc.categoryId._id?.toString() : (doc.categoryId ? doc.categoryId.toString() : "");

    let resolvedSubCatName = typeof doc.subCategoryId === 'object' && doc.subCategoryId ? doc.subCategoryId.name : (doc.subCategory || "");
    let resolvedSubCatId = typeof doc.subCategoryId === 'object' && doc.subCategoryId ? doc.subCategoryId._id?.toString() : (doc.subCategoryId ? doc.subCategoryId.toString() : "");

    if (!resolvedCatId && resolvedCatName) {
      const foundCat = await Category.findOne({ name: new RegExp(`^${resolvedCatName.trim()}$`, 'i'), level: 0 }).lean();
      if (foundCat) resolvedCatId = foundCat._id.toString();
    }
    if (!resolvedSubCatId && resolvedSubCatName) {
      const foundSub = await Category.findOne({ name: new RegExp(`^${resolvedSubCatName.trim()}$`, 'i'), level: 1 }).lean();
      if (foundSub) {
        resolvedSubCatId = foundSub._id.toString();
        if (!resolvedCatId && foundSub.parentId) {
          resolvedCatId = foundSub.parentId.toString();
          const parentCat = await Category.findById(foundSub.parentId).lean();
          if (parentCat) resolvedCatName = parentCat.name;
        }
      }
    }

    const rawAdditional = doc.additionalCategoryIds || [];
    const additionalCategoryIds = rawAdditional.map(c => typeof c === 'object' && c ? c._id?.toString() : c?.toString() || "").filter(Boolean);
    const additionalCategories = rawAdditional.map(c => typeof c === 'object' && c ? { _id: c._id?.toString(), name: c.name, parentId: c.parentId, level: c.level } : c).filter(Boolean);

    const productDetails = {
      _id: doc._id.toString(),
      styleGroupId: doc.styleGroupId,
      productCode: doc.productCode,
      name: doc.name,
      brand: typeof doc.brandId === 'object' && doc.brandId ? doc.brandId.name : (doc.brand || doc.soldBy || ""),
      brandId: typeof doc.brandId === 'object' && doc.brandId ? doc.brandId._id?.toString() : (doc.brandId || ""),
      merchant: typeof doc.merchantId === 'object' && doc.merchantId ? {
        id: doc.merchantId._id?.toString(),
        name: doc.merchantId.name || "",
        shopName: doc.merchantId.shopName || "",
        email: doc.merchantId.email || ""
      } : null,
      soldBy: doc.soldBy || "",
      styleName: doc.styleName || "",
      category: resolvedCatName,
      categoryId: resolvedCatId,
      subCategory: resolvedSubCatName,
      subCategoryId: resolvedSubCatId,
      additionalCategoryIds,
      additionalCategories,
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
      attributes: (doc.attributes || []).map(a => {
        const attrObj = a.attributeId && typeof a.attributeId === 'object' ? a.attributeId : null;
        return {
          attributeId: attrObj?._id?.toString() || a.attributeId?.toString() || "",
          name: attrObj?.name || "",
          slug: attrObj?.slug || "",
          inputType: attrObj?.inputType || "text",
          value: a.value
        };
      }),
      features: doc.features instanceof Map ? Object.fromEntries(doc.features) : (doc.features || {}),
      matchingProducts: doc.matchingProducts || [],
      collectionIds: (doc.collectionIds || []).map(c => c?._id?.toString() || c?.toString() || ""),
      sizes: siblings.map(s => ({
        _id: s._id.toString(),
        size: s.size,
        merchantSizeCode: s.merchantSizeCode,
        stock: s.stock,
        productCode: s.productCode
      })),
      variants: Object.values(colorGroups)
    };

    return res.status(200).json({
      ...productDetails,
      product: productDetails
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
    let name = '';
    let slug = '';
    let inputType = '';
    if (rawId && typeof rawId === 'object') {
      name = rawId.name || '';
      slug = rawId.slug || '';
      inputType = rawId.inputType || '';
      rawId = rawId._id || rawId.id;
    }
    return {
      attributeId: rawId ? rawId.toString() : '',
      name,
      slug,
      inputType,
      value: a.value
    };
  }).filter(a => a.attributeId);
};

export const getProductsByMerchantId = async (req, res) => {
  try {
    const merchantId = req.params.merchantId || req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ message: "Merchant ID is required" });
    }

    const merchant = await Merchant.findById(merchantId);
    if (merchant && merchant.accountType === 'warehouse' && merchant.warehouseId) {
      const products = await ProductFlat.find({ warehouseId: merchant.warehouseId, source: 'warehouse', isDeleted: { $ne: true } })
        .populate("brandId", "name")
        .populate("categoryId", "name")
        .populate("subCategoryId", "name")
        .populate("merchantId", "shopName email brandName")
        .populate("attributes.attributeId", "name slug inputType values")
        .sort({ createdAt: -1 });

      const groups = {};
      products.forEach(p => {
        const colorName = p.color?.name || 'Default';
        const key = `${p.styleGroupId || p._id}_${colorName}`;
        if (!groups[key]) {
          groups[key] = {
            id: p.styleGroupId || p._id.toString(),
            _id: p.styleGroupId || p._id.toString(),
            styleGroupId: p.styleGroupId || p._id.toString(),
            name: p.name,
            productCode: p.productCode,
            merchantSizeCode: p.merchantSizeCode || null,
            styleName: p.styleName || "",
            source: 'warehouse',
            warehouseId: p.warehouseId,
            attributes: cleanAttributesHelper(p.attributes),
            features: p.features instanceof Map ? Object.fromEntries(p.features) : (p.features || {}),
            merchant: { id: p.merchantId?._id?.toString(), shopName: p.merchantId?.shopName || "", email: p.merchantId?.email || "" },
            brand: p.brandId?.name || p.brand || "",
            category: p.categoryId?.name || p.category || "",
            subCategory: p.subCategoryId?.name || p.subCategory || "",
            brandId: p.brandId?._id?.toString() || p.brandId || null,
            categoryId: p.categoryId?._id?.toString() || p.categoryId || null,
            subCategoryId: p.subCategoryId?._id?.toString() || p.subCategoryId || null,
            additionalCategoryIds: (p.additionalCategoryIds || []).map(c => typeof c === 'object' && c ? c._id?.toString() : c?.toString() || "").filter(Boolean),
            gender: p.gender, description: p.description, tags: p.tags, isTriable: p.isTriable,
            ratings: p.ratings, numReviews: p.numReviews, isActive: p.isActive,
            color: p.color, mrp: p.mrp, price: p.price, discount: p.discount, images: p.images,
            createdAt: p.createdAt, updatedAt: p.updatedAt,
            sizes: [],
            variants: [{
              _id: p._id.toString(),
              color: p.color,
              mrp: p.mrp,
              price: p.price,
              discount: p.discount,
              images: p.images,
              sizes: []
            }]
          };
        }
        const szItem = {
          _id: p._id.toString(),
          size: p.size,
          stock: p.stock,
          productCode: p.productCode,
          merchantSizeCode: p.merchantSizeCode || null
        };
        groups[key].sizes.push(szItem);
        groups[key].variants[0].sizes.push(szItem);
      });

      return res.status(200).json(Object.values(groups));
    }

    const flatProducts = await ProductFlat.find({
      merchantId,
      isDeleted: { $ne: true }
    })
      .populate("brandId", "name")
      .populate("categoryId", "name")
      .populate("subCategoryId", "name")
      .populate("merchantId", "shopName email brandName")
      .populate("attributes.attributeId", "name slug inputType values")
      .sort({ createdAt: -1 });

    if (!flatProducts || flatProducts.length === 0) {
      return res.status(200).json([]);
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
      return res.status(200).json([]);
    }

    // Group by styleGroupId + color.name
    const groups = {};
    validFlatProducts.forEach(p => {
      const colorName = p.color?.name || 'Default';
      const key = `${p.styleGroupId}_${colorName}`;
      if (!groups[key]) {
        groups[key] = {
          id: p.styleGroupId || p._id.toString(),
          _id: p.styleGroupId || p._id.toString(),
          styleGroupId: p.styleGroupId || p._id.toString(),
          name: p.name,
          productCode: p.productCode,
          merchantSizeCode: p.merchantSizeCode || null,
          source: p.source || 'shop',
          warehouseId: p.warehouseId || null,
          addedByOperator: p.addedByOperator || null,
          merchant: {
            id: p.merchantId?._id?.toString(),
            shopName: p.merchantId?.shopName || "",
            email: p.merchantId?.email || "",
          },
          brand: p.brandId?.name || p.brand || "",
          category: p.categoryId?.name || p.category || "",
          subCategory: p.subCategoryId?.name || p.subCategory || "",
          brandId: p.brandId?._id?.toString() || p.brandId || null,
          categoryId: p.categoryId?._id?.toString() || p.categoryId || null,
          subCategoryId: p.subCategoryId?._id?.toString() || p.subCategoryId || null,
          additionalCategoryIds: (p.additionalCategoryIds || []).map(c => typeof c === 'object' && c ? c._id?.toString() : c?.toString() || "").filter(Boolean),
          gender: p.gender,
          styleName: p.styleName || "",
          description: p.description,
          tags: p.tags,
          attributes: cleanAttributesHelper(p.attributes),
          features: p.features instanceof Map ? Object.fromEntries(p.features) : (p.features || {}),
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
          sizes: [],
          variants: [{
            _id: p._id.toString(),
            color: p.color,
            mrp: p.mrp,
            price: p.price,
            discount: p.discount,
            images: p.images,
            sizes: []
          }]
        };
      }
      const szItem = {
        _id: p._id.toString(),
        size: p.size,
        stock: p.stock,
        productCode: p.productCode,
        merchantSizeCode: p.merchantSizeCode || null
      };
      groups[key].sizes.push(szItem);
      groups[key].variants[0].sizes.push(szItem);
    });

    const transformed = Object.values(groups);
    return res.status(200).json(transformed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ " + error.message });
  }
};


export const uploadProductImage = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    // Upload to cloudinary / storage
    const results = await storageService.uploadMultiple(req.files || [], "products");

    let product = null;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await ProductFlat.findById(productId);
    }
    if (!product) {
      product = await ProductFlat.findOne({ styleGroupId: productId, isDeleted: { $ne: true } });
    }
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const targetColorName = product.color?.name;
    const colorQuery = targetColorName ? { "color.name": targetColorName } : {};

    await ProductFlat.updateMany(
      { styleGroupId: product.styleGroupId, ...colorQuery, isDeleted: { $ne: true } },
      { $push: { images: { $each: results } } }
    );

    const updated = await ProductFlat.findById(product._id);
    return res.status(200).json({
      message: "✅ Images uploaded successfully",
      images: updated ? updated.images : results
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

    const isObjId = mongoose.Types.ObjectId.isValid(imageId);
    const filter = isObjId 
      ? { $or: [{ 'images._id': imageId }, { 'images.public_id': imageId }] }
      : { 'images.public_id': imageId };

    const product = await ProductFlat.findOne(filter);
    if (!product) return res.status(404).json({ error: 'Image not found' });

    const targetImage = product.images.find(img => img._id?.toString() === imageId || img.public_id === imageId);
    if (targetImage?.public_id) {
      try {
        await storageService.deleteFile(targetImage.public_id);
      } catch (storageErr) {
        console.warn("Storage deletion warning:", storageErr.message);
      }
    }

    const targetColorName = product.color?.name;
    const colorQuery = targetColorName ? { "color.name": targetColorName } : {};

    await ProductFlat.updateMany(
      { styleGroupId: product.styleGroupId, ...colorQuery },
      {
        $pull: {
          images: {
            $or: [
              ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(imageId) }] : []),
              { public_id: imageId }
            ]
          }
        }
      }
    );

    return res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const isAdmin = Boolean(req.admin);

    const isObjId = mongoose.Types.ObjectId.isValid(productId);

    let ownerCondition = {};
    if (!isAdmin) {
      ownerCondition = await getProductOwnerCondition(req);
    }

    // Match by styleGroupId, _id, or productCode
    const matchConditions = [
      { styleGroupId: productId },
      ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(productId) }] : []),
      { productCode: productId }
    ];

    const targetDoc = await ProductFlat.findOne({
      $or: matchConditions,
      ...ownerCondition
    });

    let deleteFilter;
    if (targetDoc) {
      deleteFilter = targetDoc.styleGroupId
        ? { styleGroupId: targetDoc.styleGroupId, ...ownerCondition }
        : { _id: targetDoc._id, ...ownerCondition };
    } else {
      deleteFilter = {
        $or: matchConditions,
        ...ownerCondition
      };
    }

    const deleted = await ProductFlat.updateMany(
      deleteFilter,
      { $set: { isDeleted: true, isActive: false } }
    );

    if (!deleted || deleted.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      message: "Product deleted successfully",
      deletedCount: deleted.modifiedCount,
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
    const isAdmin = Boolean(req.admin);

    const isObjId = mongoose.Types.ObjectId.isValid(productId);
    const ownerFilter = isAdmin ? {} : await getProductOwnerCondition(req);

    let targetStyleGroupId = productId;
    if (isObjId) {
      const parentDoc = await ProductFlat.findById(productId);
      if (parentDoc) targetStyleGroupId = parentDoc.styleGroupId;
    }

    const filter = { styleGroupId: targetStyleGroupId, ...ownerFilter };
    const allFlatVariants = await ProductFlat.find(filter);
    const targetColorVariants = allFlatVariants.filter(
      v => generateColorVariantId(targetStyleGroupId, v.color?.name || v.color) === variantId || v._id?.toString() === variantId
    );

    if (targetColorVariants.length > 0) {
      const colorName = targetColorVariants[0].color?.name || targetColorVariants[0].color;
      const deleteCondition = {
        styleGroupId: targetStyleGroupId,
        "color.name": colorName,
        ...ownerFilter
      };
      await ProductFlat.deleteMany(deleteCondition);
    }

    const siblings = await ProductFlat.find({ styleGroupId: targetStyleGroupId, isActive: true, isDeleted: { $ne: true } });
    return res.json({
      success: true,
      message: "Variant deleted successfully",
      product: makeFlatPayload(siblings),
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
    console.log("editProduct id:", id);
    console.log("editProduct updateData keys:", Object.keys(updateData));

    const isAdmin = Boolean(req.admin);
    const merchantId = req.merchantId;

    if (!isAdmin && !merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Strip only immutable system keys
    const restrictedFields = ['_id', 'createdAt', 'updatedAt', 'variants'];
    restrictedFields.forEach((field) => delete updateData[field]);

    // Locate product document by ObjectId, styleGroupId, or productCode
    let doc = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      doc = await ProductFlat.findById(id);
    }
    if (!doc) {
      doc = await ProductFlat.findOne({ styleGroupId: id, isDeleted: { $ne: true } });
    }
    if (!doc) {
      doc = await ProductFlat.findOne({ styleGroupId: id });
    }
    if (!doc) {
      doc = await ProductFlat.findOne({ productCode: id });
    }
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check ownership: Admin can edit any product; merchant must own it or be an authorized warehouse operator
    if (!isAdmin) {
      const isAuthorized = await verifyProductAuthorization(doc, req);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Not authorized to edit this product' });
      }
    }

    // Sanitize ObjectIds to prevent Mongoose CastErrors when changing or clearing
    const sanitizeObjectId = (val) => {
      if (!val || val === '' || val === 'null' || val === 'undefined') return null;
      if (typeof val === 'object' && val._id) val = val._id;
      const str = String(val).trim();
      return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
    };

    if ('categoryId' in updateData) {
      updateData.categoryId = sanitizeObjectId(updateData.categoryId);
    }
    if ('subCategoryId' in updateData) {
      updateData.subCategoryId = sanitizeObjectId(updateData.subCategoryId);
    }
    if ('subSubCategoryId' in updateData) {
      updateData.subSubCategoryId = sanitizeObjectId(updateData.subSubCategoryId);
    }
    if ('brandId' in updateData) {
      updateData.brandId = sanitizeObjectId(updateData.brandId);
    }
    if ('warehouseId' in updateData) {
      updateData.warehouseId = sanitizeObjectId(updateData.warehouseId);
    }
    if ('additionalCategoryIds' in updateData) {
      const parsedAdd = safeParse(updateData.additionalCategoryIds);
      updateData.additionalCategoryIds = await resolveCategoryHierarchy(Array.isArray(parsedAdd) ? parsedAdd : (parsedAdd ? [parsedAdd] : []));
    }

    // Numbers sanitization
    if ('price' in updateData) {
      const p = Number(updateData.price);
      updateData.price = isNaN(p) ? 0 : p;
    }
    if ('mrp' in updateData) {
      const m = Number(updateData.mrp);
      updateData.mrp = isNaN(m) ? (updateData.price ?? doc.price) : m;
    }
    if ('discount' in updateData) {
      const d = Number(updateData.discount);
      updateData.discount = isNaN(d) ? 0 : d;
    }

    // Gender sanitization
    if ('gender' in updateData) {
      let gArr = updateData.gender;
      if (typeof gArr === 'string') {
        try { gArr = JSON.parse(gArr); } catch { gArr = gArr.split(','); }
      }
      if (Array.isArray(gArr)) {
        const cleanGenders = gArr
          .map(g => String(g).trim().toUpperCase())
          .filter(g => ['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'].includes(g));
        if (cleanGenders.length > 0) {
          updateData.gender = cleanGenders;
        }
      }
    }

    // Sanitize attributes if provided
    if (updateData.attributes && Array.isArray(updateData.attributes)) {
      updateData.attributes = updateData.attributes
        .filter(a => a && (a.attributeId || a.attribute))
        .map(a => {
          let rawId = a.attributeId || a.attribute;
          if (rawId && typeof rawId === 'object') {
            rawId = rawId._id || rawId.id;
          }
          const idStr = rawId ? String(rawId).trim() : '';
          return {
            attributeId: mongoose.Types.ObjectId.isValid(idStr) ? new mongoose.Types.ObjectId(idStr) : idStr,
            value: a.value
          };
        })
        .filter(a => a.attributeId);
    }

    // Sanitize images if provided in editProduct
    if (updateData.images && Array.isArray(updateData.images)) {
      updateData.images = updateData.images
        .filter(img => img && (img.url || typeof img === 'string'))
        .map(img => {
          if (typeof img === 'string') {
            return { url: img, public_id: '' };
          }
          return {
            url: img.url,
            public_id: img.public_id || '',
            ...(img._id && mongoose.Types.ObjectId.isValid(String(img._id)) ? { _id: new mongoose.Types.ObjectId(String(img._id)) } : {})
          };
        });
    }

    const { sizes, ...sharedFields } = updateData;

    const targetColorName = updateData.color?.name || doc.color?.name;
    const colorQuery = targetColorName ? { "color.name": targetColorName } : {};

    // 1. Manage sizes ONLY if sizes array is explicitly provided
    if (sizes && Array.isArray(sizes)) {
      const existingDocs = await ProductFlat.find({ 
        styleGroupId: doc.styleGroupId, 
        ...colorQuery,
        isDeleted: { $ne: true }
      });

      const incomingIds = sizes.map(s => s._id).filter(Boolean).map(String);
      for (const existing of existingDocs) {
        if (!incomingIds.includes(existing._id.toString())) {
          await ProductFlat.updateOne({ _id: existing._id }, { isDeleted: true });
        }
      }

      for (const sizeObj of sizes) {
        const cleanSize = (sizeObj.size || '').replace(/\s+/g, '').toUpperCase();
        
        if (sizeObj._id) {
          const setFields = { 
            ...sharedFields,
            size: sizeObj.size,
            stock: Number(sizeObj.stock) || 0
          };
          if (sizeObj.merchantSizeCode !== undefined) {
             setFields.merchantSizeCode = sizeObj.merchantSizeCode;
          }
          await ProductFlat.updateOne(
            { _id: sizeObj._id },
            { $set: setFields }
          );
        } else {
          // Check if an existing document with this size already exists (including soft-deleted)
          const existingSameSize = await ProductFlat.findOne({
            styleGroupId: doc.styleGroupId,
            ...colorQuery,
            size: cleanSize
          });

          if (existingSameSize) {
            const setFields = {
              ...sharedFields,
              size: sizeObj.size,
              stock: Number(sizeObj.stock) || 0,
              isDeleted: false
            };
            if (sizeObj.merchantSizeCode !== undefined) {
              setFields.merchantSizeCode = sizeObj.merchantSizeCode;
            }
            await ProductFlat.updateOne(
              { _id: existingSameSize._id },
              { $set: setFields }
            );
          } else {
            const base = doc.toObject();
            delete base._id;
            delete base.__v;
            delete base.createdAt;
            delete base.updatedAt;

            const parentProductCode = base.productCode?.split('-')[0] || base.productCode || 'PRD';
            const cleanColor = (base.color?.name || 'DEFAULT').replace(/\s+/g, '').toUpperCase();

            let productCode;
            if (sizeObj.merchantSizeCode) {
               const merchantPrefix = base.productCode?.split('-').slice(0, 2).join('-') || 'PRD';
               productCode = `${merchantPrefix}-${sizeObj.merchantSizeCode.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
            } else {
               productCode = `${parentProductCode}-${cleanColor}-${cleanSize}-${Date.now().toString(36).toUpperCase()}`;
            }

            const newSizeDoc = new ProductFlat({
              ...base,
              ...sharedFields,
              size: sizeObj.size,
              stock: Number(sizeObj.stock) || 0,
              merchantSizeCode: sizeObj.merchantSizeCode,
              productCode: productCode
            });
            await newSizeDoc.save();
          }
        }
      }
    }

    // 2. Separate style-level and variant-level updates
    const styleFieldKeys = [
      'name', 'styleName', 'description', 'brandId', 'categoryId',
      'subCategoryId', 'subSubCategoryId', 'additionalCategoryIds', 'gender', 'soldBy',
      'matchingProducts', 'features', 'attributes', 'tags',
      'collectionIds', 'isTriable', 'isActive', 'isVerified'
    ];

    const styleLevelFields = {};
    const variantLevelFields = {};

    Object.keys(sharedFields).forEach(key => {
      if (key === 'stock') return; // Do not overwrite per-size stocks with global stock
      if (styleFieldKeys.includes(key)) {
        styleLevelFields[key] = sharedFields[key];
      } else {
        variantLevelFields[key] = sharedFields[key];
      }
    });

    if (Object.keys(styleLevelFields).length > 0) {
      await ProductFlat.updateMany(
        { styleGroupId: doc.styleGroupId, isDeleted: { $ne: true } },
        { $set: styleLevelFields }
      );

      // Keep categories synchronized between linked warehouse twins / catalog parents
      const categorySyncFields = {};
      if (styleLevelFields.categoryId !== undefined) categorySyncFields.categoryId = styleLevelFields.categoryId;
      if (styleLevelFields.subCategoryId !== undefined) categorySyncFields.subCategoryId = styleLevelFields.subCategoryId;
      if (styleLevelFields.subSubCategoryId !== undefined) categorySyncFields.subSubCategoryId = styleLevelFields.subSubCategoryId;
      if (styleLevelFields.additionalCategoryIds !== undefined) categorySyncFields.additionalCategoryIds = styleLevelFields.additionalCategoryIds;

      if (Object.keys(categorySyncFields).length > 0) {
        if (doc.linkedMerchantProductId) {
          await ProductFlat.updateMany(
            { styleGroupId: doc.linkedMerchantProductId, isDeleted: { $ne: true } },
            { $set: categorySyncFields }
          );
        }
        await ProductFlat.updateMany(
          { linkedMerchantProductId: doc.styleGroupId, isDeleted: { $ne: true } },
          { $set: categorySyncFields }
        );
      }
    }

    if (Object.keys(variantLevelFields).length > 0) {
      // If color is not specified or updateAllVariants is requested, update across entire style group
      const variantUpdateQuery = (updateData.updateAllVariants || !updateData.color)
        ? { styleGroupId: doc.styleGroupId, isDeleted: { $ne: true } }
        : { styleGroupId: doc.styleGroupId, ...colorQuery, isDeleted: { $ne: true } };

      await ProductFlat.updateMany(
        variantUpdateQuery,
        { $set: variantLevelFields }
      );
    }

    // Return one of the updated documents as sample
    const updatedSample = await ProductFlat.findOne({ styleGroupId: doc.styleGroupId, isDeleted: { $ne: true } }) 
      || await ProductFlat.findById(doc._id);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedSample,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating product: ' + error.message,
      error: error.message,
    });
  }
};


export const editVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const updateData = req.body;
    const isAdmin = Boolean(req.admin);

    const filter = isAdmin ? { styleGroupId: productId } : { styleGroupId: productId, merchantId: req.merchantId };
    const allFlatVariants = await ProductFlat.find(filter);
    const targetColorVariants = allFlatVariants.filter(
      v => generateColorVariantId(productId, v.color.name) === variantId
    );
    if (!targetColorVariants.length) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    const colorName = targetColorVariants[0].color.name;
    const restrictedFields = ['_id', 'createdAt', 'updatedAt', 'variants'];
    restrictedFields.forEach((field) => delete updateData[field]);

    const updateCondition = isAdmin
      ? { styleGroupId: productId, "color.name": colorName }
      : { styleGroupId: productId, "color.name": colorName, merchantId: req.merchantId };

    await ProductFlat.updateMany(
      updateCondition,
      { $set: updateData }
    );

    const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
    return res.status(200).json({
      success: true,
      message: 'Variant updated successfully',
      product: makeFlatPayload(siblings),
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
    const isAdmin = Boolean(req.admin);

    if (stock === undefined) {
      return res.status(400).json({ success: false, message: "Stock value is required" });
    }

    const filter = isAdmin ? { styleGroupId: productId } : { styleGroupId: productId, merchantId: req.merchantId };
    const allFlatVariants = await ProductFlat.find(filter);
    let targetColorVariants = allFlatVariants.filter(
      v => generateColorVariantId(productId, v.color?.name) === variantId || v._id?.toString() === variantId
    );

    const colorName = targetColorVariants.length ? targetColorVariants[0].color?.name : null;
    let query = { styleGroupId: productId, size: sizeName };
    if (colorName) query["color.name"] = colorName;
    if (!isAdmin) query.merchantId = req.merchantId;

    const updatedProduct = await ProductFlat.findOneAndUpdate(
      query,
      { $set: { stock: Number(stock) || 0 } },
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
    const isAdmin = Boolean(req.admin);

    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({ success: false, message: "Sizes array is required" });
    }

    const filter = isAdmin ? { styleGroupId: productId } : { styleGroupId: productId, merchantId: req.merchantId };
    const allFlatVariants = await ProductFlat.find(filter);
    const targetColorVariants = allFlatVariants.filter(
      v => generateColorVariantId(productId, v.color?.name) === variantId || v._id?.toString() === variantId
    );
    if (!targetColorVariants.length) {
      return res.status(404).json({ success: false, message: "Product or variant not found" });
    }

    const baseVariantDoc = targetColorVariants[0];
    const colorName = baseVariantDoc.color.name;
    const incomingSizeNames = sizes.map((s) => s.size);

    for (const sizeObj of sizes) {
      if (!sizeObj.size || sizeObj.stock === undefined) continue;

      const existingSizeDoc = targetColorVariants.find(v => v.size === sizeObj.size);
      if (existingSizeDoc) {
        const updateData = { stock: Number(sizeObj.stock) || 0 };
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

        const parentProductCode = base.productCode?.split('-')[0] || base.productCode || 'PRD';
        const cleanColor = (base.color?.name || 'DEFAULT').replace(/\s+/g, '').toUpperCase();
        const cleanSize = (sizeObj.size || '').replace(/\s+/g, '').toUpperCase();

        let productCode;
        if (sizeObj.merchantSizeCode) {
           const merchantPrefix = base.productCode?.split('-').slice(0, 2).join('-') || 'PRD';
           productCode = `${merchantPrefix}-${sizeObj.merchantSizeCode.toUpperCase().replace(/\s+/g, '')}-${cleanSize}`;
        } else {
           productCode = `${parentProductCode}-${cleanColor}-${cleanSize}-${Date.now().toString(36).toUpperCase()}`;
        }

        const newSizeDoc = new ProductFlat({
          ...base,
          size: sizeObj.size,
          stock: Number(sizeObj.stock) || 0,
          merchantSizeCode: sizeObj.merchantSizeCode,
          productCode: productCode
        });
        await newSizeDoc.save();
      }
    }

    const deleteCondition = {
      styleGroupId: productId,
      "color.name": colorName,
      size: { $nin: incomingSizeNames }
    };
    if (!isAdmin) deleteCondition.merchantId = req.merchantId;

    await ProductFlat.deleteMany(deleteCondition);

    const siblings = await ProductFlat.find({ styleGroupId: productId, isActive: true });
    return res.status(200).json({
      success: true,
      message: "Sizes updated successfully (added, updated, and removed as needed)",
      product: makeFlatPayload(siblings),
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
      attributes, tags, collectionIds, variants, additionalCategoryIds 
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
            : rawId,
          value: a.value
        };
      })
      .filter(Boolean)
      .filter(a => a.value !== undefined && a.value !== null && a.value !== '' && (!Array.isArray(a.value) || a.value.length > 0));

    if (!variants.length) {
      return res.status(400).json({ success: false, message: "Missing required variants" });
    }

    const finalName = name ? name.trim() : (styleName ? styleName.trim() : "New Product");
    if (!gender || (Array.isArray(gender) && gender.length === 0)) {
      gender = ['MEN', 'WOMEN'];
    }

    const validCategoryId = (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) ? new mongoose.Types.ObjectId(categoryId) : undefined;
    const validSubCategoryId = (subCategoryId && mongoose.Types.ObjectId.isValid(subCategoryId)) ? new mongoose.Types.ObjectId(subCategoryId) : undefined;
    const validAdditionalCategoryIds = await resolveCategoryHierarchy(safeParse(additionalCategoryIds));

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

    let category = null;
    if (validCategoryId) {
      category = await Category.findById(validCategoryId);
    }
    const catPrefix = category ? category.name.slice(0, 2).toUpperCase() : "GP";
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const baseProductCode = `${merchantPrefix}-${brandPrefix}-${catPrefix}-${randPart}`;

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
      const variantColor = (variant.color && variant.color.name) ? variant.color : { name: 'Standard', hex: '#111827' };
      const cleanColor = variantColor.name.replace(/\s+/g, '').toUpperCase();
      const sellingPrice = isNaN(Number(variant.price)) ? 0 : Number(variant.price);
      const variantMrp = (variant.mrp && !isNaN(Number(variant.mrp)) && Number(variant.mrp) > 0) ? Number(variant.mrp) : sellingPrice;
      const variantDiscount = isNaN(Number(variant.discount)) ? 0 : Number(variant.discount);
      
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
          name: finalName,
          description,
          styleName,
          categoryId: validCategoryId,
          subCategoryId: validSubCategoryId,
          additionalCategoryIds: validAdditionalCategoryIds,
          brandId,
          merchantId,
          gender,
          attributes: cleanAttributes,
          tags,
          collectionIds,
          isTriable: req.body.isTriable === 'true' || req.body.isTriable === true,
          isActive: false, // Default false until approved
          productCode,
          color: variantColor,
          size: sizeInfo.size,
          merchantSizeCode: sizeInfo.merchantSizeCode,
          stock: isNaN(Number(sizeInfo.stock)) ? 0 : Number(sizeInfo.stock),
          mrp: variantMrp,
          price: sellingPrice,
          discount: variantDiscount,
          images: finalImages,
        });

        await newDoc.save();
        createdDocs.push(newDoc);
      }
    }
    return res.status(201).json({ 
      success: true, 
      message: "Product created with variants successfully", 
      productId: baseProductCode,
      ...(req.aiMetadata ? { aiMetadata: req.aiMetadata } : {})
    });
  } catch (err) {
    console.error("Create product full error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * AI-assisted product analysis controller.
 * Analyzes an uploaded product image using Gemini and returns extracted metadata
 * (name, styleName, description, gender, category, categoryId, subCategory, subCategoryId, tags, color, isTriable)
 * so merchant web and mobile apps can auto-fill form fields with beautiful UI/UX.
 */
export const analyzeProductAi = async (req, res) => {
  try {
    console.log('🤖 [AI Product Analysis] Incoming request for merchant:', req.merchantId || req.body?.merchantId || 'Unknown');
    const files = req.files || [];
    let imageFile = null;

    if (Array.isArray(files) && files.length > 0) {
      imageFile = files.find(f => ['image', 'productImage', 'aiImage', 'file', 'photo'].includes(f.fieldname)) || files[0];
    } else if (req.file) {
      imageFile = req.file;
    }

    let imageInput = null;
    let mimeType = 'image/jpeg';

    if (Array.isArray(files) && files.length > 0) {
      const buffers = files.filter(f => f.buffer).map(f => ({ buffer: f.buffer, mimetype: f.mimetype }));
      if (buffers.length > 1) {
        imageInput = buffers;
      } else if (buffers.length === 1) {
        imageInput = buffers[0].buffer;
        mimeType = buffers[0].mimetype || 'image/jpeg';
      }
    } else if (imageFile && imageFile.buffer) {
      imageInput = imageFile.buffer;
      mimeType = imageFile.mimetype || 'image/jpeg';
    } else if (req.body.image && typeof req.body.image === 'string') {
      imageInput = req.body.image;
      if (req.body.mimeType) mimeType = req.body.mimeType;
    }

    if (!imageInput) {
      return res.status(400).json({
        success: false,
        message: "A product image is required for AI analysis. Upload an image file (e.g. 'image') or provide a base64 string in 'image'."
      });
    }

    let aiMetadata;
    try {
      aiMetadata = await analyzeProductImage(imageInput, mimeType);
    } catch (aiErr) {
      console.error("AI product image analysis error:", aiErr);
      return res.status(422).json({
        success: false,
        message: `AI product analysis failed: ${aiErr.message}`
      });
    }

    // Optional merchant gender filtering if configured
    const targetMerchantId = req.merchantId || req.body?.merchantId;
    if (targetMerchantId) {
      try {
        const merchantDoc = await Merchant.findById(targetMerchantId).select('genderCategory').lean();
        if (merchantDoc && Array.isArray(merchantDoc.genderCategory) && merchantDoc.genderCategory.length > 0) {
          const allowedUpper = merchantDoc.genderCategory.map(g => String(g).trim().toUpperCase());
          let curGenders = Array.isArray(aiMetadata.gender) ? aiMetadata.gender : (aiMetadata.gender ? [aiMetadata.gender] : []);
          const filteredGenders = curGenders.filter(g => allowedUpper.includes(String(g).toUpperCase()));
          if (filteredGenders.length > 0) {
            aiMetadata.gender = filteredGenders;
          }
        }
      } catch (err) {
        // non-blocking
      }
    }

    return res.status(200).json({
      success: true,
      message: "Product image analyzed successfully with Gemini AI",
      data: aiMetadata
    });
  } catch (error) {
    console.error("Unexpected error in analyzeProductAi:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze product image with AI"
    });
  }
};

/**
 * AI-assisted product creation controller.
 * Analyzes the uploaded product image using Gemini, extracts and validates product metadata,
 * merges it with merchant-controlled fields (price, stock, SKU, sizes),
 * and delegates creation to existing createProductFull logic.
 */
export const createProductAi = async (req, res) => {
  try {
    // 1. Identify the image file or base64 input
    const files = req.files || [];
    let imageFile = null;

    if (Array.isArray(files) && files.length > 0) {
      imageFile = files.find(f => ['image', 'productImage', 'aiImage', 'file'].includes(f.fieldname)) || files[0];
    }

    let imageInput = null;
    let mimeType = 'image/jpeg';

    if (imageFile && imageFile.buffer) {
      imageInput = imageFile.buffer;
      mimeType = imageFile.mimetype || 'image/jpeg';
    } else if (req.body.image && typeof req.body.image === 'string') {
      imageInput = req.body.image;
    }

    if (!imageInput) {
      return res.status(400).json({
        success: false,
        message: "A product image is required for AI analysis. Upload an image file (e.g. 'image') or provide a base64 string in 'image'."
      });
    }

    // 2. Run Gemini AI image analysis
    let aiMetadata;
    try {
      aiMetadata = await analyzeProductImage(imageInput, mimeType);
    } catch (aiErr) {
      console.error("AI product image analysis error:", aiErr);
      return res.status(422).json({
        success: false,
        message: `AI product analysis failed: ${aiErr.message}`
      });
    }

    // 3. Verify category and subcategory against active database records
    if (!aiMetadata.categoryId || !aiMetadata.subCategoryId) {
      return res.status(400).json({
        success: false,
        message: "AI could not determine a valid category and subcategory from the image."
      });
    }

    const [dbCategory, dbSubCategory] = await Promise.all([
      Category.findOne({ _id: aiMetadata.categoryId, isActive: true }).lean(),
      Category.findOne({ _id: aiMetadata.subCategoryId, isActive: true, parentId: aiMetadata.categoryId }).lean(),
    ]);

    if (!dbCategory) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive category identified by AI: "${aiMetadata.category}"`
      });
    }

    if (!dbSubCategory) {
      return res.status(400).json({
        success: false,
        message: `Invalid or inactive subcategory identified by AI: "${aiMetadata.subCategory}" under "${dbCategory.name}"`
      });
    }

    // 4. Parse incoming merchant data safely
    const safeParse = (value) => {
      if (!value) return value;
      if (typeof value === "string") {
        try { return JSON.parse(value); } catch { return value; }
      }
      return value;
    };

    let incomingVariants = safeParse(req.body.variants);

    // Support flat fields if full variants array was not sent
    if (!incomingVariants || !Array.isArray(incomingVariants) || incomingVariants.length === 0) {
      const flatSizes = safeParse(req.body.sizes);
      const flatPrice = req.body.price;

      if (!flatSizes || !Array.isArray(flatSizes) || flatSizes.length === 0 || flatPrice === undefined) {
        return res.status(400).json({
          success: false,
          message: "Missing required merchant data. You must provide selling 'price' and at least one size in 'sizes' (or a 'variants' array)."
        });
      }

      incomingVariants = [{
        price: flatPrice,
        mrp: req.body.mrp,
        discount: req.body.discount,
        productSku: req.body.productSku,
        sizes: flatSizes,
        color: safeParse(req.body.color),
        imageFields: req.body.imageFields ? safeParse(req.body.imageFields) : [],
      }];
    }

    // 5. Merge AI metadata without overwriting merchant-controlled fields
    // AI controls catalog fields: name, styleName, description, gender, categoryId, subCategoryId, tags, isTriable, attributes
    req.body.name = req.body.name ? String(req.body.name).trim() : aiMetadata.name;
    req.body.styleName = req.body.styleName ? String(req.body.styleName).trim() : aiMetadata.styleName;
    req.body.description = req.body.description ? String(req.body.description).trim() : aiMetadata.description;
    req.body.gender = req.body.gender ? safeParse(req.body.gender) : aiMetadata.gender;

    // Constrain gender by creating merchant's registered genderCategory if configured
    const targetMerchantId = req.merchantId || req.body.merchantId;
    if (targetMerchantId) {
      const merchantDoc = await Merchant.findById(targetMerchantId).select('genderCategory').lean();
      if (merchantDoc && Array.isArray(merchantDoc.genderCategory) && merchantDoc.genderCategory.length > 0) {
        const allowedUpper = merchantDoc.genderCategory.map(g => String(g).trim().toUpperCase());
        let curGenders = Array.isArray(req.body.gender) ? req.body.gender : (req.body.gender ? [req.body.gender] : []);
        const filteredGenders = curGenders.filter(g => allowedUpper.includes(String(g).toUpperCase()));
        if (filteredGenders.length > 0) {
          req.body.gender = filteredGenders;
        } else {
          req.body.gender = allowedUpper.filter(g => ['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'].includes(g));
        }
      }
    }

    req.body.categoryId = String(aiMetadata.categoryId);
    req.body.subCategoryId = String(aiMetadata.subCategoryId);
    req.body.tags = req.body.tags ? safeParse(req.body.tags) : aiMetadata.tags;
    req.body.isTriable = req.body.isTriable !== undefined ? req.body.isTriable : aiMetadata.isTriable;
    req.body.attributes = req.body.attributes ? safeParse(req.body.attributes) : aiMetadata.attributes;

    // Attach AI color and all uploaded images to variants
    req.body.variants = incomingVariants.map((v) => {
      const variantCopy = { ...v };

      // Apply AI color if merchant didn't provide a custom color name
      if (!variantCopy.color || !variantCopy.color.name || variantCopy.color.name === 'Standard') {
        variantCopy.color = aiMetadata.color;
      }

      // Ensure all uploaded images get linked and saved to Cloudinary
      if (files.length > 0) {
        const allFieldnames = files.map(f => f.fieldname);
        if (!variantCopy.imageFields || !Array.isArray(variantCopy.imageFields) || variantCopy.imageFields.length === 0) {
          variantCopy.imageFields = allFieldnames;
        } else {
          variantCopy.imageFields = Array.from(new Set([...variantCopy.imageFields, ...allFieldnames]));
        }
      }

      return variantCopy;
    });

    // Attach aiMetadata for the response
    req.aiMetadata = aiMetadata;

    // 6. Forward directly into the existing createProductFull logic
    return await createProductFull(req, res);

  } catch (err) {
    console.error("AI Create Product Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during AI product creation: " + err.message
    });
  }
};

export const searchBaseProducts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(200).json({ success: true, products: [] });
    }

    const flexRegex = buildFlexibleSearchRegex(query);
    const match = { isDeleted: { $ne: true } };
    match.$or = [
      { name: flexRegex },
      { styleName: flexRegex },
      { tags: { $in: [flexRegex] } }
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

    // Verify ownership
    const ownerCondition = await getProductOwnerCondition(req);
    const product = await ProductFlat.findOne({ styleGroupId: productId, ...ownerCondition });
    if (!product) {
      // Fallback: check if the productId is actually an _id and it belongs to merchant/warehouse
      const productById = await ProductFlat.findOne({ _id: productId, ...ownerCondition });
      if (!productById) {
        return res.status(404).json({ message: "Product not found or not owned by you" });
      }
      await ProductFlat.updateMany(
        { styleGroupId: productById.styleGroupId, ...ownerCondition },
        { $set: { matchingProducts } }
      );
    } else {
      await ProductFlat.updateMany(
        { styleGroupId: productId, ...ownerCondition },
        { $set: { matchingProducts } }
      );
    }
    return res.status(200).json({ message: "Matching products updated successfully" });
  } catch (error) {
    console.error("Error in updateMatchingProducts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};




