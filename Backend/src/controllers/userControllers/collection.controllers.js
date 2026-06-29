import Collection from '../../models/collection.model.js';
import Product from '../../models/product.model.js';
import Merchant from '../../models/merchant.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

/**
 * ── Get Collections For Home Page ──
 * Fetches active collections and their products, 
 * filtered by proximity (req.nearbyMerchantIds) and merchant online status.
 */
export const getCollectionsForHome = asyncHandler(async (req, res) => {
  const { gender } = req.query;
  const nearbyIds = req.nearbyMerchantIds;

  console.log(`[Debug] getCollectionsForHome - Gender: ${gender}, NearbyIDs Count: ${nearbyIds?.length || 0}`);

  // 1. Fetch active collections
  const collections = await Collection.find({ isActive: true })
    .sort({ priority: -1 })
    .lean();

  console.log(`[Debug] Found ${collections.length} active collections in DB`);

  if (!collections || collections.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], "No collections found"));
  }

  // 2. Resolve Online Merchants within range
  let onlineNearbyIds = [];
  if (nearbyIds && nearbyIds.length > 0) {
    const onlineMerchants = await Merchant.find({
      _id: { $in: nearbyIds },
      isOnline: true,
      isActive: true,
      isVerified: true
    }).select('_id').lean();
    onlineNearbyIds = onlineMerchants.map(m => m._id);
    console.log(`[Debug] Nearby merchants found: ${nearbyIds.length}, Online & active: ${onlineNearbyIds.length}`);
  } else {
      console.log(`[Debug] No merchants nearby (req.nearbyMerchantIds is empty)`);
      return res.status(200).json(new ApiResponse(200, [], "No available merchants nearby"));
  }

  // 3. For each collection, find eligible products
  const result = await Promise.all(collections.map(async (coll) => {
    const productFilter = {
      collectionIds: coll._id,
      isActive: true,
      merchantId: { $in: onlineNearbyIds },
      variants: { $exists: true, $not: { $size: 0 } }
    };

    if (gender && gender !== 'All') {
      productFilter.gender = gender;
    }

    const products = await Product.find(productFilter)
      .select('name merchantId brandId ratings numReviews variants')
      .populate('merchantId', 'isOnline isZoneLive')
      .limit(10)
      .lean();

    console.log(`[Debug] Collection "${coll.name}" (${coll._id}) - Products matching filter: ${products.length}`);

    // If no products, we can also check why
    if (products.length === 0) {
        const diagnosticProducts = await Product.find({ collectionIds: coll._id }).lean();
        console.log(`[Debug] --- Deep Diagnostics for Collection "${coll.name}" ---`);
        diagnosticProducts.forEach(p => {
            console.log(`[Product: ${p.name}] 
              - merchantId: ${p.merchantId} (Is it in ${onlineNearbyIds}?)
              - gender: ${JSON.stringify(p.gender)} (Searching for: ${gender})
              - isActive: ${p.isActive}
              - Variants Count: ${p.variants?.length || 0}`);
        });
    }

    // Trim variants for mobile card view
    const trimmedProducts = products.map(p => {
      const v = p.variants?.[0];
      const merchant = p.merchantId;
      const merchantIdStr = merchant?._id?.toString() || p.merchantId?.toString();

      const isNearby = req.nearbyMerchantIds?.some(id => id.toString() === merchantIdStr) || false;
      const isOnline = merchant?.isOnline !== false;
      const isZoneLive = merchant?.isZoneLive !== false;

      return {
        _id: p._id,
        name: p.name,
        merchantId: merchantIdStr,
        brandId: p.brandId,
        ratings: p.ratings,
        numReviews: p.numReviews,
        variantId: v?._id,
        price: v?.price,
        mrp: v?.mrp,
        discount: v?.discount || 0,
        images: v?.images,
        color: v?.color,
        isNearby,
        isOnline,
        isInstantBuyable: isNearby && isOnline && isZoneLive,
      };
    });

    return {
      _id: coll._id,
      name: coll.name,
      description: coll.description,
      banner: coll.bannerImage?.url ? { imageUrl: coll.bannerImage.url } : null,
      products: trimmedProducts
    };
  }));

  // Filter out collections that have 0 products available for this user's location
  const filteredResult = result.filter(r => r.products.length > 0);
  console.log(`[Debug] Final collections with products: ${filteredResult.length}`);

  return res.status(200).json(new ApiResponse(200, filteredResult, "Collections fetched successfully"));
});
