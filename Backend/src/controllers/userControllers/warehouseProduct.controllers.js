import Product from '../../models/product.model.js';
import Warehouse from '../../models/warehouse.model.js';
import Merchant from '../../models/merchant.model.js';
import Cart from '../../models/cart.model.js';
import CourierCart from '../../models/courierCart.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Helper: check if a warehouse is currently active and serving the user's zone.
 */
const getActiveWarehouse = async (warehouseId) => {
  return Warehouse.findOne({ _id: warehouseId, isActive: true }).lean();
};

/**
 * GET /user/warehouse/merchants
 * Fast path to get all approved merchants assigned to the local warehouse.
 */
export const getWarehouseMerchants = asyncHandler(async (req, res) => {
  if (!req.nearbyWarehouseIds || req.nearbyWarehouseIds.length === 0) {
    return res.status(200).json({ merchants: [] });
  }

  // Optimize: directly query Merchant collection for assigned warehouses
  const merchants = await Merchant.find({
    isActive: true,
    isVerified: true,
    warehouseStatus: 'approved',
    assignedWarehouseIds: { $in: req.nearbyWarehouseIds }
  })
    .select('_id shopName logo isOnline rating reviewCount')
    .lean();

  return res.status(200).json({ merchants });
});

/**
 * GET /user/warehouse/products
 * List warehouse products for the customer home screen.
 * Supports: gender, categoryId, page, limit filters.
 * 
 * Each card shows: name, brand, price, mrp, discount, images, isTriable,
 * sellerLabel = "Fulfilled by FlashFits" + merchant brand info.
 */
export const getWarehouseProducts = asyncHandler(async (req, res) => {
  const { gender, categoryId, subCategoryId, page = 1, limit = 20 } = req.query;

  const filter = {
    source: 'warehouse',
    isActive: { $ne: false },
    isDeleted: { $ne: true },
    'variants.0': { $exists: true }, // must have at least one variant
  };

  if (gender && gender !== 'All') {
    filter.gender = { $in: [new RegExp("^" + gender + "$", "i")] };
  }
  if (categoryId) filter.categoryId = categoryId;
  if (subCategoryId) filter.subCategoryId = subCategoryId;

  const skip = (Number(page) - 1) * Number(limit);

  const products = await Product.find(filter)
    .select('name productCode warehouseId merchantId brandId categoryId gender isTriable ratings numReviews variants')
    .populate('brandId', 'name logo')
    .populate('merchantId', 'shopName logo')
    .populate('warehouseId', 'name code supportsTryAndBuy supportsCourier')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  // Shape the response: one card per product (first variant for card thumbnail)
  const cards = products.map((p) => {
    const v = p.variants?.[0];
    return {
      _id: p._id,
      productCode: p.productCode,
      name: p.name,
      brandId: p.brandId,
      gender: p.gender,
      ratings: p.ratings,
      numReviews: p.numReviews,
      variantId: v?._id,
      price: v?.price,
      mrp: v?.mrp,
      discount: v?.discount || 0,
      images: v?.images,
      color: v?.color,
      isTriable: p.isTriable,
      // Warehouse listing labels (Q5 answer: show merchant brand, "Fulfilled by FlashFits")
      sellerLabel: 'Fulfilled by FlashFits',
      merchantId: p.merchantId, // Include full populated object for frontend brand mapping
      merchantBrand: p.merchantId?.shopName || null,
      merchantLogo: p.merchantId?.logo || null,
      warehouseId: p.warehouseId?._id,
      warehouseName: p.warehouseId?.name,
      supportsTryAndBuy: p.warehouseId?.supportsTryAndBuy ?? false,
      supportsCourier: p.warehouseId?.supportsCourier ?? false,
      // Flag so the frontend knows this is a warehouse listing (not a merchant shop listing)
      isWarehouseListing: true,
    };
  });

  return res.status(200).json({ products: cards, page: Number(page), limit: Number(limit) });
});

/**
 * GET /user/warehouse/products/:id
 * Full product detail for a warehouse listing.
 * Returns all variants and sizes (for size picker).
 */
export const getWarehouseProductDetail = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    source: 'warehouse',
    isActive: true,
    isVerified: true,
    isDeleted: false,
  })
    .populate('brandId', 'name logo')
    .populate('merchantId', 'shopName logo address isOnline isZoneLive')
    .populate('warehouseId', 'name code supportsTryAndBuy supportsCourier operatingHours')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('attributes.attributeId', 'name')
    .lean();

  if (!product) {
    return res.status(404).json({ message: 'Warehouse product not found' });
  }

  const warehouse = product.warehouseId;

  // Check if same product is also available in a nearby live merchant store
  let availableInShop = false;
  let shopMerchantId = null;
  let shopMerchantName = null;

  if (product.merchantId && req.nearbyMerchantIds) {
    const merchantIdStr = (product.merchantId._id || product.merchantId).toString();
    const nearbySet = new Set(req.nearbyMerchantIds.map(id => id.toString()));

    if (nearbySet.has(merchantIdStr)) {
      const isMerchantLive = product.merchantId.isOnline !== false && product.merchantId.isZoneLive !== false;
      if (isMerchantLive) {
        const shopProduct = await Product.findOne({
          merchantId: product.merchantId._id || product.merchantId,
          $or: [
            ...(product.sourceProductId ? [{ _id: product.sourceProductId }] : []),
            { sourceProductId: product._id },
            { name: product.name }
          ],
          source: { $ne: 'warehouse' },
          isActive: true,
        }).select('_id').lean();

        if (shopProduct) {
          availableInShop = true;
          shopMerchantId = product.merchantId._id || product.merchantId;
          shopMerchantName = product.merchantId.shopName || null;
        }
      }
    }
  }

  const fulfillmentOptions = {
    flashmart: {
      available: true,
      estimatedTime: "45 Mins",
      label: "FlashMart Express",
      warehouseId: warehouse?._id || null,
      warehouseName: warehouse?.name || "FlashFits Hub",
    },
    directStore: {
      available: availableInShop,
      estimatedTime: "45-60 Mins",
      label: "Direct Store",
      shopName: shopMerchantName || product.merchantId?.shopName || "Partner Shop",
      merchantId: shopMerchantId || product.merchantId?._id,
    },
    courier: {
      available: warehouse?.supportsCourier ?? true,
      estimatedTime: "2-4 Days",
      label: "Standard Courier",
    },
  };

  return res.status(200).json({
    ...product,
    sellerLabel: 'Fulfilled by FlashFits',
    merchantBrand: product.merchantId?.shopName || null,
    merchantLogo: product.merchantId?.logo || null,
    warehouseName: warehouse?.name,
    supportsTryAndBuy: warehouse?.supportsTryAndBuy ?? false,
    supportsCourier: warehouse?.supportsCourier ?? false,
    isWarehouseListing: true,
    availableInShop,
    shopMerchantId,
    shopMerchantName,
    fulfillmentOptions,
  });
});

/**
 * POST /user/warehouse/cart/add
 * Add a warehouse product to the T&B cart (source = 'warehouse').
 * Validates stock availability.
 */
export const addWarehouseProductToCart = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { warehouseProductId, variantId, size, quantity, image } = req.body;

  if (!warehouseProductId || !variantId || !size || !quantity) {
    throw new ApiError(400, 'warehouseProductId, variantId, size, and quantity are required');
  }

  const whProduct = await Product.findOne({
    _id: warehouseProductId,
    source: 'warehouse',
    isActive: true,
    isVerified: true,
    isDeleted: false,
  });

  if (!whProduct) throw new ApiError(404, 'Warehouse product not found');

  const warehouse = await getActiveWarehouse(whProduct.warehouseId);
  if (!warehouse) throw new ApiError(400, 'This warehouse is currently inactive');
  if (!warehouse.supportsTryAndBuy) {
    throw new ApiError(400, 'This warehouse does not support Try & Buy');
  }

  // Check stock
  const variant = whProduct.variants.id(variantId);
  if (!variant) throw new ApiError(404, 'Variant not found');

  const sizeObj = variant.sizes.find((s) => s.size === size);
  if (!sizeObj) throw new ApiError(400, `Size ${size} not available`);

  const availableStock = sizeObj.stock - (sizeObj.reservedStock || 0);
  if (availableStock < quantity) {
    throw new ApiError(400, `Only ${availableStock} units available for this size`);
  }

  // Add to T&B cart
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }

  // Check if this exact item is already in cart
  const existingIdx = cart.items.findIndex(
    (i) =>
      i.source === 'warehouse' &&
      i.warehouseProductId?.toString() === warehouseProductId &&
      i.variantId?.toString() === variantId &&
      i.size === size
  );

  if (existingIdx !== -1) {
    cart.items[existingIdx].quantity += quantity;
  } else {
    cart.items.push({
      // productId and merchantId are null for warehouse items
      productId: null,
      variantId,
      size,
      quantity,
      stockQuantity: availableStock,
      image: image ? { url: image } : undefined,
      merchantId: null,
      source: 'warehouse',
      warehouseId: whProduct.warehouseId,
      warehouseProductId,
    });
  }

  cart.updatedAt = new Date();
  await cart.save();

  return res.status(200).json({ message: 'Added to cart', cart });
});

/**
 * POST /user/warehouse/courier-cart/add
 * Add a warehouse product to the Courier cart (source = 'warehouse').
 */
export const addWarehouseProductToCourierCart = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { warehouseProductId, variantId, size, quantity, image } = req.body;

  if (!warehouseProductId || !variantId || !size || !quantity) {
    throw new ApiError(400, 'warehouseProductId, variantId, size, and quantity are required');
  }

  const whProduct = await Product.findOne({
    _id: warehouseProductId,
    source: 'warehouse',
    isActive: true,
    isVerified: true,
    isDeleted: false,
  });

  if (!whProduct) throw new ApiError(404, 'Warehouse product not found');

  const warehouse = await getActiveWarehouse(whProduct.warehouseId);
  if (!warehouse) throw new ApiError(400, 'This warehouse is currently inactive');
  if (!warehouse.supportsCourier) {
    throw new ApiError(400, 'This warehouse does not support courier delivery');
  }

  const variant = whProduct.variants.id(variantId);
  if (!variant) throw new ApiError(404, 'Variant not found');

  const sizeObj = variant.sizes.find((s) => s.size === size);
  if (!sizeObj) throw new ApiError(400, `Size ${size} not available`);

  const availableStock = sizeObj.stock - (sizeObj.reservedStock || 0);
  if (availableStock < quantity) {
    throw new ApiError(400, `Only ${availableStock} units available`);
  }

  let cart = await CourierCart.findOne({ userId });
  if (!cart) {
    cart = await CourierCart.create({ userId, items: [] });
  }

  const existingIdx = cart.items.findIndex(
    (i) =>
      i.source === 'warehouse' &&
      i.warehouseProductId?.toString() === warehouseProductId &&
      i.variantId?.toString() === variantId &&
      i.size === size
  );

  if (existingIdx !== -1) {
    cart.items[existingIdx].quantity += quantity;
  } else {
    cart.items.push({
      productId: null,
      variantId,
      size,
      quantity,
      stockQuantity: availableStock,
      image: image ? { url: image } : undefined,
      merchantId: null,
      source: 'warehouse',
      warehouseId: whProduct.warehouseId,
      warehouseProductId,
    });
  }

  cart.updatedAt = new Date();
  await cart.save();

  return res.status(200).json({ message: 'Added to courier cart', cart });
});
