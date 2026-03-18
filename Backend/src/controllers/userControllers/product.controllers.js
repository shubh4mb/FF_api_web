import Product from '../../models/product.model.js';
import Cart from '../../models/cart.model.js';
import Wishlist from '../../models/wishlist.model.js';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator'

export const newArrivals = async (req, res) => {
  try {
    const { gender } = req.query;

    const filter = {
      isActive: true,
      createdAt: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 90))
      },
      variants: { $exists: true, $not: { $size: 0 } }
    };

    if (gender && gender !== 'All') {
      filter.gender = gender;
    }

    const products = await Product.find(filter)
      .select('name merchantId brandId ratings numReviews variants')
      .lean();

    // Return only first variant card-level data
    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      return {
        _id: p._id,
        name: p.name,
        merchantId: p.merchantId,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
      };
    });

    res.status(200).json(trimmed);
  } catch (error) {
    console.error('Error in newArrivals:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

export const productsDetails = async (req, res) => {
  try {
    const product = await Product.findOne(
      { _id: req.params.id, isActive: true }
    )
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name')
      .populate('subSubCategoryId', 'name')
      .populate('merchantId', 'shopName')
      .lean();

    res.status(200).json(product);
  } catch (error) {
    console.error('Error in productsDetails:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

// ── Trending Products ──
export const trendingProducts = async (req, res) => {
  try {
    const { gender } = req.query;

    const filter = {
      isActive: true,
      variants: { $exists: true, $not: { $size: 0 } }
    };

    if (gender && gender !== 'All') {
      filter.gender = gender;
    }

    const products = await Product.find(filter)
      .select('name merchantId brandId ratings numReviews variants')
      .sort({ numReviews: -1, ratings: -1 }) // Sort by popularity
      .limit(15) // Limit to top 15 trending
      .lean();

    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      return {
        _id: p._id,
        name: p.name,
        merchantId: p.merchantId,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
      };
    });

    res.status(200).json(trimmed);
  } catch (error) {
    console.error('Error in trendingProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

// ── Recommended Products (You May Like) ──
export const recommendedProducts = async (req, res) => {
  try {
    const { gender } = req.query;
    const userId = req.user?.userId;

    let subCategoryIds = [];
    let excludedProductIds = [];

    if (userId) {
      // 1. Get recent Cart items
      const cart = await Cart.findOne({ userId }).lean();
      if (cart && cart.items) {
        excludedProductIds.push(...cart.items.map(i => i.productId));
      }

      // 2. Get recent Wishlist items
      const wishlist = await Wishlist.find({ userId }).select('productId').lean();
      if (wishlist.length > 0) {
        excludedProductIds.push(...wishlist.map(w => w.productId));
      }

      // 3. Find categories of those items
      if (excludedProductIds.length > 0) {
        const userProducts = await Product.find({ _id: { $in: excludedProductIds } })
          .select('subCategoryId subSubCategoryId')
          .lean();

        userProducts.forEach(p => {
          if (p.subCategoryId) subCategoryIds.push(p.subCategoryId.toString());
          if (p.subSubCategoryId) subCategoryIds.push(p.subSubCategoryId.toString());
        });

        // Make unique
        subCategoryIds = [...new Set(subCategoryIds)];
      }
    }

    const filter = {
      isActive: true,
      variants: { $exists: true, $not: { $size: 0 } }
    };

    if (gender && gender !== 'All') filter.gender = gender;

    if (excludedProductIds.length > 0) {
      filter._id = { $nin: excludedProductIds };
    }

    if (subCategoryIds.length > 0) {
      filter.$or = [
        { subCategoryId: { $in: subCategoryIds } },
        { subSubCategoryId: { $in: subCategoryIds } }
      ];
    }

    let products = await Product.find(filter)
      .select('name merchantId brandId ratings numReviews variants')
      .limit(15)
      .lean();

    // Fallback if recommendations don't match anything (e.g. no cart history)
    if (products.length < 5) {
      delete filter.$or; // remove strict category filter
      products = await Product.find(filter)
        .select('name merchantId brandId ratings numReviews variants')
        .sort({ createdAt: -1 })
        .limit(15)
        .lean();
    }

    const trimmed = products.map(p => {
      const v = p.variants?.[0];
      return {
        _id: p._id,
        name: p.name,
        merchantId: p.merchantId,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
      };
    });

    res.status(200).json(trimmed);
  } catch (error) {
    console.error('Error in recommendedProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
}

const sortMap = {
  newest: { createdAt: -1 },
  priceLowToHigh: { price: 1 },          // 👈 use projected field
  priceHighToLow: { price: -1 },
  customerRating: { ratings: -1 },
  discount: { discount: -1 }       // projected field too
};


export const getFilteredProducts = async (req, res) => {
  try {
    const {
      priceRange = [],
      selectedCategoryIds = [],
      selectedColors = [],
      selectedStores = [],
      sortBy = 'newest',
      search = '',
    } = req.body;



    /* ----------- base match filter ----------- */
    const match = { isActive: true };

    /* ✅ Merchant filter */
    if (selectedStores?.length > 0) {
      const merchantObjectIds = selectedStores
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      if (merchantObjectIds.length > 0) {
        match.merchantId = { $in: merchantObjectIds };

      } else {

        return res.json({ products: [] });
      }
    }

    /* ✅ Category filter */
    let categoryFilter = null;
    if (selectedCategoryIds.length > 0) {
      const validCatIds = selectedCategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validCatIds.length > 0) {
        const categoryObjectIds = validCatIds.map(id => new mongoose.Types.ObjectId(id));
        categoryFilter = {
          $or: [
            { categoryId: { $in: categoryObjectIds } },
            { subCategoryId: { $in: categoryObjectIds } },
            { subSubCategoryId: { $in: categoryObjectIds } },
          ],
        };

      }
    }

    /* ----------------- aggregation pipeline ---------------- */
    let pipeline = [
      { $match: match },

      /* 1️⃣ Perform lookups early to access related fields */
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
          pipeline: [{ $project: { shopName: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'categories', // Assuming 'categories' is the collection for categoryId
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'categories', // Assuming same collection for subCategoryId
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategory',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'categories', // Assuming same collection for subSubCategoryId
          localField: 'subSubCategoryId',
          foreignField: '_id',
          as: 'subSubCategory',
          pipeline: [{ $project: { name: 1 } }],
        },
      },

      /* 2️⃣ Unwind variants */
      { $unwind: '$variants' },

      /* 3️⃣ Search filter (including looked-up fields) */
      ...(search.trim() !== ''
        ? [
          {
            $match: {
              $or: [
                { name: new RegExp(search.trim(), 'i') },
                { 'variants.color.name': new RegExp(search.trim(), 'i') },
                { 'category.name': new RegExp(search.trim(), 'i') },
                { 'subCategory.name': new RegExp(search.trim(), 'i') },
                { 'subSubCategory.name': new RegExp(search.trim(), 'i') },
                { 'brand.name': new RegExp(search.trim(), 'i') },
                { 'merchant.shopName': new RegExp(search.trim(), 'i') },
              ],
            },
          },
        ]
        : []),

      /* 4️⃣ Apply category filter */
      ...(categoryFilter ? [{ $match: categoryFilter }] : []),

      /* 5️⃣ Variant-level filters (price, color) */
      {
        $match: {
          ...(priceRange.length === 2 && {
            'variants.price': { $gte: priceRange[0], $lte: priceRange[1] },
          }),
          ...(selectedColors.length > 0 && {
            'variants.color.name': { $in: selectedColors },
          }),
        },
      },

      /* 6️⃣ Project essential fields */
      {
        $project: {
          name: 1,
          merchantId: 1,
          brandId: 1,
          categoryId: 1,
          subCategoryId: 1,
          subSubCategoryId: 1,
          gender: 1,
          ratings: 1,
          numReviews: 1,
          isTriable: 1,
          variantId: '$variants._id',
          price: '$variants.price',
          mrp: '$variants.mrp',
          discount: '$variants.discount',
          stockSizes: '$variants.sizes',
          color: '$variants.color',
          images: '$variants.images',
          merchant: { $arrayElemAt: ['$merchant.shopName', 0] },
          brand: { $arrayElemAt: ['$brand.name', 0] },
          category: { $arrayElemAt: ['$category.name', 0] },
          subCategory: { $arrayElemAt: ['$subCategory.name', 0] },
          subSubCategory: { $arrayElemAt: ['$subSubCategory.name', 0] },
        },
      },
    ];

    /* 7️⃣ Sorting logic */
    const sortMap = {
      newest: { _id: -1 },
      oldest: { _id: 1 },
      priceLowToHigh: { price: 1 },
      priceHighToLow: { price: -1 },
      discount: { discount: -1 },
      rating: { ratings: -1 },
    };

    const sortKeys = Array.isArray(sortBy) ? sortBy : [sortBy];
    let finalSort = {};

    sortKeys.forEach(key => {
      if (sortMap[key]) Object.assign(finalSort, sortMap[key]);
    });

    if (Object.keys(finalSort).length > 0) {
      pipeline.push({ $sort: finalSort });
    }

    /* 8️⃣ Execute aggregation */
    const products = await Product.aggregate(pipeline).allowDiskUse(true);
    res.json({ products });
  } catch (err) {
    console.error('Error in getFilteredProducts:', err);
    res.status(500).json({ error: 'Server error' });
  }
};




export const getProductsByMerchantId = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const products = await Product.find({ merchantId: merchantId })
      .select('name brandId categoryId subCategoryId subSubCategoryId gender variants ratings numReviews')
      .populate([
        { path: 'brandId', select: 'name' },
        { path: 'categoryId', select: 'name' },
        { path: 'subCategoryId', select: 'name' },
        { path: 'subSubCategoryId', select: 'name' },
      ])
      .lean();

    const modifiedProducts = products.map(product => {
      const mainVariant = product.variants?.[0];
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

    res.json({ products: modifiedProducts });
  } catch (err) {
    console.error('Error in getProductsByMerchantId:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getYouMayLikeProducts = async (req, res) => {
  try {
    const { subSubCategoryId, merchantId, excludeId, limit = 10 } = req.query;

    if (!subSubCategoryId || !mongoose.Types.ObjectId.isValid(subSubCategoryId)) {
      return res.status(400).json({ message: '❌ Invalid or missing subSubCategoryId' });
    }

    const subSubId = new mongoose.Types.ObjectId(subSubCategoryId);
    const merchId = mongoose.Types.ObjectId.isValid(merchantId) ? new mongoose.Types.ObjectId(merchantId) : null;
    const excludeObjId = mongoose.Types.ObjectId.isValid(excludeId) ? new mongoose.Types.ObjectId(excludeId) : null;

    const matchConditions = {
      subSubCategoryId: subSubId,
      isActive: true,
    };

    if (excludeObjId) {
      matchConditions._id = { $ne: excludeObjId };
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $addFields: {
          priority: {
            $cond: [
              { $eq: ['$merchantId', merchId] },
              0,
              1,
            ],
          },
        },
      },
      { $sort: { priority: 1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
          pipeline: [{ $project: { shopName: 1 } }],
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
      // Project card-level fields only
      {
        $project: {
          name: 1,
          ratings: 1,
          numReviews: 1,
          gender: 1,
          isTriable: 1,
          merchantId: 1,
          brand: '$brand.name',
          merchant: '$merchant.shopName',
          // First variant only
          variantId: { $arrayElemAt: ['$variants._id', 0] },
          price: { $arrayElemAt: ['$variants.price', 0] },
          mrp: { $arrayElemAt: ['$variants.mrp', 0] },
          discount: { $arrayElemAt: ['$variants.discount', 0] },
          images: { $arrayElemAt: ['$variants.images', 0] },
          color: { $arrayElemAt: ['$variants.color', 0] },
        },
      },
    ];

    const products = await Product.aggregate(pipeline);

    res.status(200).json(products);
  } catch (error) {
    console.error('Error in getYouMayLikeProducts:', error.message);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};

// New: Batch fetch products for multiple merchants
export const getProductsBatch = async (req, res) => {
  // Input validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { merchantIds } = req.body;

  // Validate ObjectIds
  const validIds = merchantIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length !== merchantIds.length) {
    return res.status(400).json({ message: 'One or more invalid merchant IDs' });
  }

  // Limit batch size
  if (merchantIds.length > 50) {
    return res.status(400).json({ message: 'Batch size exceeds limit (max 50)' });
  }

  try {
    // Fetch products using aggregation
    const products = await Product.aggregate([
      // Match active products for the merchant IDs
      {
        $match: {
          merchantId: { $in: merchantIds.map(id => new mongoose.Types.ObjectId(id)) },
          isActive: true
        }
      },
      // Group by merchantId to apply limit per merchant
      {
        $group: {
          _id: '$merchantId',
          products: { $push: '$$ROOT' }
        }
      },
      // Limit to 5 products per merchant
      {
        $project: {
          products: { $slice: ['$products', 5] }
        }
      },
      // Unwind to flatten products
      { $unwind: '$products' },
      // Project first variant's fields
      {
        $project: {
          _id: '$products._id',
          name: '$products.name',
          merchantId: '$products.merchantId',
          ratings: '$products.ratings',
          gender: '$products.gender',
          categoryId: '$products.categoryId',
          subCategoryId: '$products.subCategoryId',
          subSubCategoryId: '$products.subSubCategoryId',
          brandId: '$products.brandId',
          price: { $arrayElemAt: ['$products.variants.price', 0] },
          mrp: { $arrayElemAt: ['$products.variants.mrp', 0] },
          discount: { $arrayElemAt: ['$products.variants.discount', 0] },
          images: { $arrayElemAt: ['$products.variants.images', 0] }
        }
      },
      // Populate category and brand names
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId'
        }
      },
      { $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategoryId'
        }
      },
      { $unwind: { path: '$subCategoryId', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'subSubCategoryId',
          foreignField: '_id',
          as: 'subSubCategoryId'
        }
      },
      { $unwind: { path: '$subSubCategoryId', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brandId'
        }
      },
      { $unwind: { path: '$brandId', preserveNullAndEmptyArrays: true } },
      // Group by merchantId for final output
      {
        $group: {
          _id: '$merchantId',
          products: {
            $push: {
              _id: '$_id',
              name: '$name',
              merchantId: '$merchantId',
              ratings: '$ratings',
              gender: '$gender',
              price: '$price',
              mrp: '$mrp',
              discount: '$discount',
              images: '$images',
              categoryId: '$categoryId.name',
              subCategoryId: '$subCategoryId.name',
              subSubCategoryId: '$subSubCategoryId.name',
              brandId: '$brandId.name'
            }
          }
        }
      }
    ]);

    // Format as { merchantId1: [products], ... }
    const productsByMerchant = products.reduce((acc, group) => {
      acc[group._id.toString()] = group.products;
      return acc;
    }, {});

    res.status(200).json(productsByMerchant);
  } catch (error) {
    console.error('Error fetching batch products:', error);
    res.status(500).json({ message: 'Server error fetching batch products' });
  }
};







