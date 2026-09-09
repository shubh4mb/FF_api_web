import ProductFlat from '../../models/productFlat.model.js';
import Warehouse from '../../models/warehouse.model.js';
import Merchant from '../../models/merchant.model.js';
import Cart from '../../models/cart.model.js';
import CourierCart from '../../models/courierCart.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateColorVariantId } from '../../utils/variantAdapter.js';

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
 */
export const getWarehouseProducts = asyncHandler(async (req, res) => {
  const { gender, categoryId, subCategoryId, page = 1, limit = 20 } = req.query;

  const filter = {
    $or: [{ source: 'warehouse' }, { warehouseId: { $exists: true, $ne: null } }],
    isActive: { $ne: false },
    isDeleted: { $ne: true },
  };

  if (gender && gender !== 'All') {
    filter.gender = { $in: [new RegExp("^" + gender + "$", "i")] };
  }
  if (categoryId) filter.categoryId = categoryId;
  if (subCategoryId) filter.subCategoryId = subCategoryId;

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline = [
    { $match: filter },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$styleGroupId',
        doc: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
  ];

  const products = await ProductFlat.aggregate(pipeline);
  await ProductFlat.populate(products, [
    { path: 'brandId', select: 'name logo' },
    { path: 'merchantId', select: 'shopName logo' },
    { path: 'warehouseId', select: 'name code supportsTryAndBuy supportsCourier' }
  ]);

  const cards = products.map((p) => {
    return {
      _id: p.styleGroupId,
      productCode: p.productCode,
      name: p.name,
      brandId: p.brandId,
      gender: p.gender,
      ratings: p.ratings,
      numReviews: p.numReviews,
      variantId: p._id,
      price: p.price,
      mrp: p.mrp,
      discount: p.discount || 0,
      images: p.images,
      color: p.color,
      isTriable: p.isTriable,
      sellerLabel: 'Fulfilled by FlashFits',
      merchantId: p.merchantId,
      merchantBrand: p.merchantId?.shopName || null,
      merchantLogo: p.merchantId?.logo || null,
      warehouseId: p.warehouseId?._id,
      warehouseName: p.warehouseId?.name,
      supportsTryAndBuy: p.warehouseId?.supportsTryAndBuy ?? false,
      supportsCourier: p.warehouseId?.supportsCourier ?? false,
      isWarehouseListing: true,
    };
  });

  return res.status(200).json({ products: cards, page: Number(page), limit: Number(limit) });
});

/**
 * GET /user/warehouse/products/:id
 * Full product detail for a warehouse listing.
 * Returns activeProduct and siblings flat structure.
 */
export const getWarehouseProductDetail = asyncHandler(async (req, res) => {
  const flatProductDoc = await ProductFlat.findOne({
    $and: [
      { $or: [{ _id: req.params.id }, { styleGroupId: req.params.id }] },
      { $or: [{ source: 'warehouse' }, { warehouseId: { $exists: true, $ne: null } }] }
    ],
    isActive: true,
    isDeleted: { $ne: true },
  })
    .populate('brandId', 'name logo')
    .populate('merchantId', 'shopName logo address isOnline isZoneLive')
    .populate('warehouseId', 'name code supportsTryAndBuy supportsCourier operatingHours')
    .populate('categoryId', 'name')
    .populate('subCategoryId', 'name')
    .populate('attributes.attributeId', 'name')
    .lean();

  if (!flatProductDoc) {
    return res.status(404).json({ message: 'Warehouse product not found' });
  }

  const siblings = await ProductFlat.find({
    styleGroupId: flatProductDoc.styleGroupId,
    _id: { $ne: flatProductDoc._id },
    isActive: true,
    isDeleted: { $ne: true }
  });

  const warehouse = flatProductDoc.warehouseId;

  // Check if same product is also available in a nearby live merchant store
  let availableInShop = false;
  let shopMerchantId = null;
  let shopMerchantName = null;

  if (flatProductDoc.merchantId && req.nearbyMerchantIds) {
    const merchantIdStr = (flatProductDoc.merchantId._id || flatProductDoc.merchantId).toString();
    const nearbySet = new Set(req.nearbyMerchantIds.map(id => id.toString()));

    if (nearbySet.has(merchantIdStr)) {
      const isMerchantLive = flatProductDoc.merchantId.isOnline !== false && flatProductDoc.merchantId.isZoneLive !== false;
      if (isMerchantLive) {
        const shopProduct = await ProductFlat.findOne({
          merchantId: flatProductDoc.merchantId._id || flatProductDoc.merchantId,
          $or: [
            ...(flatProductDoc.sourceProductId ? [{ styleGroupId: flatProductDoc.sourceProductId }] : []),
            { sourceProductId: flatProductDoc.styleGroupId },
            { name: flatProductDoc.name }
          ],
          source: { $ne: 'warehouse' },
          isActive: true,
        }).select('_id').lean();

        if (shopProduct) {
          availableInShop = true;
          shopMerchantId = flatProductDoc.merchantId._id || flatProductDoc.merchantId;
          shopMerchantName = flatProductDoc.merchantId.shopName || null;
        }
      }
    }
  }

  const siblingsMapped = siblings.map(s => {
    const doc = s.toObject ? s.toObject() : s;
    return {
      ...doc,
      colorVariantId: generateColorVariantId(flatProductDoc.styleGroupId, doc.color?.name || 'Default')
    };
  });

  const activeDocMapped = {
    ...flatProductDoc,
    colorVariantId: generateColorVariantId(flatProductDoc.styleGroupId, flatProductDoc.color?.name || 'Default')
  };

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
      shopName: shopMerchantName || flatProductDoc.merchantId?.shopName || "Partner Shop",
      merchantId: shopMerchantId || flatProductDoc.merchantId?._id,
    },
    courier: {
      available: warehouse?.supportsCourier ?? true,
      estimatedTime: "2-4 Days",
      label: "Standard Courier",
    },
  };

  return res.status(200).json({
    isFlatPayload: true,
    activeProduct: {
      ...activeDocMapped,
      sellerLabel: 'Fulfilled by FlashFits',
      merchantBrand: flatProductDoc.merchantId?.shopName || null,
      merchantLogo: flatProductDoc.merchantId?.logo || null,
      warehouseName: warehouse?.name,
      supportsTryAndBuy: warehouse?.supportsTryAndBuy ?? false,
      supportsCourier: warehouse?.supportsCourier ?? false,
      isWarehouseListing: true,
      availableInShop,
      shopMerchantId,
      shopMerchantName,
    },
    siblings: siblingsMapped,
    fulfillmentOptions,
  });
});

/**
 * POST /user/warehouse/cart/add
 * Add a warehouse product to the T&B cart (source = 'warehouse').
 */
export const addWarehouseProductToCart = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { warehouseProductId, variantId, size, quantity, image } = req.body;

  if (!warehouseProductId || !variantId || !size || !quantity) {
    throw new ApiError(400, 'warehouseProductId, variantId, size, and quantity are required');
  }

  const whProduct = await ProductFlat.findOne({
    _id: variantId, // For flat schema, variantId is the _id of the document
    styleGroupId: warehouseProductId,
    size: size,
    source: 'warehouse',
    isActive: true,
    isDeleted: { $ne: true },
  });

  if (!whProduct) throw new ApiError(404, 'Warehouse product not found');

  const warehouse = await getActiveWarehouse(whProduct.warehouseId);
  if (!warehouse) throw new ApiError(400, 'This warehouse is currently inactive');
  if (!warehouse.supportsTryAndBuy) {
    throw new ApiError(400, 'This warehouse does not support Try & Buy');
  }

  const availableStock = whProduct.stock - (whProduct.reservedStock || 0);
  if (availableStock < quantity) {
    throw new ApiError(400, `Only ${availableStock} units available for this size`);
  }

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
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

  const whProduct = await ProductFlat.findOne({
    _id: variantId, // For flat schema, variantId is the _id of the document
    styleGroupId: warehouseProductId,
    size: size,
    source: 'warehouse',
    isActive: true,
    isDeleted: { $ne: true },
  });

  if (!whProduct) throw new ApiError(404, 'Warehouse product not found');

  const warehouse = await getActiveWarehouse(whProduct.warehouseId);
  if (!warehouse) throw new ApiError(400, 'This warehouse is currently inactive');
  if (!warehouse.supportsCourier) {
    throw new ApiError(400, 'This warehouse does not support courier delivery');
  }

  const availableStock = whProduct.stock - (whProduct.reservedStock || 0);
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
