import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Deterministically generates a 24-character Mongoose ObjectId hex string 
 * for a Color Variant, based on the parent styleGroupId and the color name.
 */
export const generateColorVariantId = (styleGroupId, colorName) => {
  const cleanGroupId = styleGroupId ? styleGroupId.toString() : new mongoose.Types.ObjectId().toString();
  const cleanColor = (colorName || 'Default').toLowerCase().trim();
  const hash = crypto.createHash('md5').update(`${cleanGroupId}_${cleanColor}`).digest('hex');
  return hash.slice(0, 24); // Return a valid 24-character hex string
};

/**
 * Translates flat database product documents into the legacy nested JSON layout
 * expected by the Customer App, Merchant App, and Admin Panel.
 * 
 * @param {Object} activeProduct - The main product document retrieved (represents one variant)
 * @param {Array} siblingProducts - List of all sibling flat variants under the same styleGroupId
 */
export const convertToLegacyFormat = (activeProduct, siblingProducts = []) => {
  if (!activeProduct) return null;

  // Unify the active product and all its sibling documents
  const allProducts = [
    activeProduct.toObject ? activeProduct.toObject() : activeProduct,
    ...siblingProducts.map(p => p.toObject ? p.toObject() : p)
  ];

  // De-duplicate documents by _id to avoid any overlap
  const seenIds = new Set();
  const uniqueProducts = allProducts.filter(p => {
    const idStr = p._id?.toString();
    if (!idStr || seenIds.has(idStr)) return false;
    seenIds.add(idStr);
    return true;
  });

  const parentGroupId = activeProduct.styleGroupId || activeProduct._id.toString();

  // Group size combinations by color name
  const colorGroups = {};
  uniqueProducts.forEach(p => {
    const colorName = p.color?.name || 'Default';
    if (!colorGroups[colorName]) {
      colorGroups[colorName] = {
        color: p.color || { name: 'Default', hex: '' },
        mrp: p.mrp || 0,
        price: p.price || 0,
        discount: p.discount || 0,
        images: p.images || [],
        sizesMap: {}
      };
    }

    // Add this size document's details to the sizes list
    colorGroups[colorName].sizesMap[p.size] = {
      _id: p._id.toString(), // The flat size combination's document _id is the sizeId
      size: p.size,
      stock: p.stock || 0
    };
  });

  // Construct the legacy variants list
  const legacyVariants = Object.keys(colorGroups).map(colorName => {
    const group = colorGroups[colorName];
    const colorVariantId = generateColorVariantId(parentGroupId, colorName);

    return {
      _id: colorVariantId,
      color: group.color,
      mrp: group.mrp,
      price: group.price,
      discount: group.discount,
      images: group.images,
      sizes: Object.values(group.sizesMap)
    };
  });

  // Re-assemble the root product object
  return {
    _id: parentGroupId, // The group ID acts as the main productId
    name: activeProduct.name,
    productCode: activeProduct.productCode,
    merchantId: activeProduct.merchantId,
    brandId: activeProduct.brandId,
    categoryId: activeProduct.categoryId,
    subCategoryId: activeProduct.subCategoryId,
    subSubCategoryId: activeProduct.subSubCategoryId,
    gender: activeProduct.gender,
    soldBy: activeProduct.soldBy,
    styleName: activeProduct.styleName,
    description: activeProduct.description,
    matchingProducts: activeProduct.matchingProducts || [],
    features: activeProduct.features || {},
    attributes: activeProduct.attributes || [],
    tags: activeProduct.tags || [],
    collectionIds: activeProduct.collectionIds || [],
    isTriable: activeProduct.isTriable !== false,
    ratings: activeProduct.ratings || 0,
    numReviews: activeProduct.numReviews || 0,
    isActive: activeProduct.isActive !== false,
    isVerified: activeProduct.isVerified || false,
    isDeleted: activeProduct.isDeleted || false,
    createdAt: activeProduct.createdAt,
    updatedAt: activeProduct.updatedAt,
    variants: legacyVariants
  };
};

/**
 * Explodes a legacy nested product creation payload (e.g. from forms)
 * into a flat list of individual size-color SKU product documents.
 * 
 * @param {Object} legacyPayload - The nested product payload from the frontend
 */
export const convertToFlatFormat = (legacyPayload) => {
  if (!legacyPayload) return [];

  const styleGroupId = legacyPayload._id?.toString() || new mongoose.Types.ObjectId().toString();

  // Establish a base product code for variant derivation
  let parentProductCode = legacyPayload.productCode;
  if (!parentProductCode) {
    const randomString = crypto.randomBytes(4).toString('hex').toUpperCase();
    parentProductCode = `PRD-${randomString}`;
  }

  const flatProducts = [];

  const baseProductData = {
    name: legacyPayload.name,
    merchantId: legacyPayload.merchantId,
    brandId: legacyPayload.brandId,
    categoryId: legacyPayload.categoryId,
    subCategoryId: legacyPayload.subCategoryId,
    subSubCategoryId: legacyPayload.subSubCategoryId,
    gender: legacyPayload.gender,
    soldBy: legacyPayload.soldBy,
    styleName: legacyPayload.styleName,
    description: legacyPayload.description,
    features: legacyPayload.features || {},
    attributes: legacyPayload.attributes || [],
    tags: legacyPayload.tags || [],
    collectionIds: legacyPayload.collectionIds || [],
    isTriable: legacyPayload.isTriable !== false,
    ratings: legacyPayload.ratings || 0,
    numReviews: legacyPayload.numReviews || 0,
    isActive: legacyPayload.isActive !== false,
    isVerified: legacyPayload.isVerified || false,
    isDeleted: legacyPayload.isDeleted || false,
    styleGroupId
  };

  const variants = legacyPayload.variants || [];

  variants.forEach(v => {
    const sizes = v.sizes || [];
    sizes.forEach(s => {
      const cleanColor = (v.color?.name || 'Default').replace(/\s+/g, '').toUpperCase();
      const cleanSize = (s.size || 'Free').replace(/\s+/g, '').toUpperCase();
      const variantProductCode = `${parentProductCode}-${cleanColor}-${cleanSize}`;

      flatProducts.push({
        ...baseProductData,
        productCode: variantProductCode,
        ...(s._id ? { _id: s._id } : {}),
        color: {
          name: v.color?.name || 'Default',
          hex: v.color?.hex || ''
        },
        size: s.size,
        stock: s.stock || 0,
        mrp: v.mrp || 0,
        price: v.price || 0,
        discount: v.discount || 0,
        images: v.images || []
      });
    });
  });

  // If payload contains no variants/sizes, create a fallback flat doc
  if (flatProducts.length === 0) {
    flatProducts.push({
      ...baseProductData,
      productCode: `${parentProductCode}-DEFAULT-FREE`,
      color: { name: 'Default', hex: '' },
      size: 'Free',
      stock: 0,
      mrp: legacyPayload.mrp || 0,
      price: legacyPayload.price || 0,
      discount: legacyPayload.discount || 0,
      images: legacyPayload.images || []
    });
  }

  return flatProducts;
};
