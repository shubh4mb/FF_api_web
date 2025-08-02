import Product from '../../models/product.model.js';
import mongoose from 'mongoose';

export const newArrivals = async (req, res) => {
    try {
        const products = await Product.find({
            isActive: true,
            createdAt: {
                $gte: new Date(new Date().setDate(new Date().getDate() - 30))
            },
            variants: { $exists: true, $not: { $size: 0 } } // only products with variants
        });

        res.status(200).json(products);
    } catch (error) {
        console.log(error);
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
          .populate('merchantId', 'name');
          
        res.status(200).json(product);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: '❌ ' + error.message });
    }
}

const sortMap = {
  newest          : { createdAt: -1 },
  priceLowToHigh  : { price: 1 },          // 👈 use projected field
  priceHighToLow  : { price: -1 },
  customerRating  : { ratings: -1 },
  discount        : { discount: -1 }       // projected field too
};


  export const getFilteredProducts = async (req, res) => {
    try {
      const {
        priceRange          = [],         // [min,max]
        selectedCategoryIds = [],         // ObjectId strings
        selectedColors      = [],         // ['Red','Blue']
        selectedStores      = [],         // merchant ObjectId strings
        sortBy              = 'newest',   // string | string[]
      } = req.body;
  
      /* ----------- build initial $match ---------------- */
      const match = { isActive: true };
  
      /* merchant filter */
      if (selectedStores.length) {
        const validStoreIds = selectedStores.filter(mongoose.Types.ObjectId.isValid);
        if (validStoreIds.length) {
          match.merchantId = {
            $in: validStoreIds.map(id => new mongoose.Types.ObjectId(id)),
          };
        }
      }
  
      /* category OR‑match across three fields */
      if (selectedCategoryIds.length) {
        const validCatIds = selectedCategoryIds.filter(mongoose.Types.ObjectId.isValid);
        if (validCatIds.length) {
          const ids = validCatIds.map(id => new mongoose.Types.ObjectId(id));
          match.$or = [
            { categoryId:       { $in: ids } },
            { subCategoryId:    { $in: ids } },
            { subSubCategoryId: { $in: ids } },
          ];
        }
      }
  
      /* ----------------- aggregation pipeline ---------------- */
      let pipeline = [
        { $match: match },
  
        /* 1️⃣  Unwind variants so each variant acts like its own product  */
        { $unwind: '$variants' },
  
        /* 2️⃣  Variant‑level filters (price, color) */
        {
          $match: {
            ...(priceRange.length === 2 && {
              'variants.price': { $gte: priceRange[0], $lte: priceRange[1] },
            }),
            ...(selectedColors.length && {
              'variants.color.name': { $in: selectedColors },
            }),
          },
        },
  
        /* 3️⃣  Optional lookups (merchant / brand names) */
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
  
        /* 4️⃣  Keep only lean fields */
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
  
            /* expose single variant fields at top level for convenience */
            variantId:   '$variants._id',
            price:       '$variants.price',
            mrp:         '$variants.mrp',
            discount:    '$variants.discount',
            stockSizes:  '$variants.sizes',     // array of sizes + stock
            color:       '$variants.color',     // { name, hex }
            images:      '$variants.images',
  
            merchant: { $arrayElemAt: ['$merchant.shopName', 0] },
            brand:    { $arrayElemAt: ['$brand.name', 0] },
          },
        },
      ];
  
      /* 5️⃣  Multi‑field sorting */
      const sortKeys = Array.isArray(sortBy) ? sortBy : [sortBy];
      let finalSort = {};
  
      sortKeys.forEach(key => {
        if (sortMap[key]) Object.assign(finalSort, sortMap[key]);
      });
  
      if (Object.keys(finalSort).length) pipeline.push({ $sort: finalSort });
  
      /* 6️⃣  (optional) pagination -> add $skip and $limit here */
  
      const products = await Product.aggregate(pipeline).allowDiskUse(true);
      res.json({ products });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  };

  export const getProductsByMerchantId = async (req, res) => {
      // console.log(req.params,'merchantId');

    try {
      const { merchantId } = req.params;
      
         // ✅ Step 1: Fetch products from DB
    const products = await Product.find({ merchantId: merchantId }).populate([
      { path: 'brandId', select: 'name' },
      { path: 'categoryId', select: 'name' },
      { path: 'subCategoryId', select: 'name' },
      { path: 'subSubCategoryId', select: 'name' },
    ]);
      const modifiedProducts = products.map(product => {
        const mainVariant = product.variants[0]; // only the first variant
      
        return {
          _id: product._id,
          name: product.name,
          brand: product.brandId,
          merchant: product.merchantId,
          gender: product.gender,
          categoryId: product.categoryId,
          subCategoryId: product.subCategoryId,
          subSubCategoryId: product.subSubCategoryId,
      
          // flattened variant fields
          variantId: mainVariant._id,
          price: mainVariant.price,
          mrp: mainVariant.mrp,
          stockSizes: mainVariant.sizes,
          color: mainVariant.color,
          images: mainVariant.images,
      
          ratings: product.ratings,
          numReviews: product.numReviews,
          discount: mainVariant.discount || 0,
      
          isMainVariant: true // optional flag
        };
      });
      
      res.json({ products : modifiedProducts });
    } catch (err) {
      console.error(err);
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
              0, // same merchant — higher priority
              1, // other merchants — lower priority
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
          as: 'brandId',
        },
      },
      {
        $unwind: { path: '$brandId', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      },
      {
        $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCategoryId',
          foreignField: '_id',
          as: 'subCategoryId',
        },
      },
      {
        $unwind: { path: '$subCategoryId', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'subsubcategories',
          localField: 'subSubCategoryId',
          foreignField: '_id',
          as: 'subSubCategoryId',
        },
      },
      {
        $unwind: { path: '$subSubCategoryId', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchantId',
        },
      },
      {
        $unwind: { path: '$merchantId', preserveNullAndEmptyArrays: true },
      },
    ];

    const products = await Product.aggregate(pipeline);

    res.status(200).json(products);
  } catch (error) {
    console.error('❌ Error in prioritized getYouMayLikeProducts:', error);
    res.status(500).json({ message: '❌ ' + error.message });
  }
};




  

  