import Offer from '../models/offer.model.js';
import OfferUsage from '../models/offerUsage.model.js';
import Order from '../models/order.model.js';
import CourierOrder from '../models/courierOrder.model.js';
import fs from 'fs';

/**
 * ── Offer Engine ──
 * Core logic for evaluating, selecting, and applying offers.
 * 
 * Stacking Policy:
 *   Best admin offer + Best merchant offer can stack.
 *   Within each scope, only the best (highest discount) applies.
 */

// ────────────────────────────────────────
// Check if a user is a first-time buyer
// ────────────────────────────────────────
export const isFirstTimeUser = async (userId) => {
  const orderCount = await Order.countDocuments({
    userId,
    orderStatus: { $nin: ['cancelled', 'rejected'] },
  });
  if (orderCount > 0) return false;

  const courierCount = await CourierOrder.countDocuments({
    userId,
    orderStatus: { $nin: ['cancelled'] },
  });
  return courierCount === 0;
};

// ────────────────────────────────────────
// Get user's usage count for an offer
// ────────────────────────────────────────
export const getUserOfferUsage = async (userId, offerId) => {
  return OfferUsage.countDocuments({ userId, offerId });
};

// ────────────────────────────────────────
// Calculate discount amount for an offer
// ────────────────────────────────────────
export const calculateDiscount = (offer, applicableAmount) => {
  if (offer.discountType === 'flat') {
    return Math.min(offer.discountValue, applicableAmount);
  }

  // percentage
  let discount = (applicableAmount * offer.discountValue) / 100;
  if (offer.maxDiscount !== null && offer.maxDiscount > 0) {
    discount = Math.min(discount, offer.maxDiscount);
  }
  return Math.min(Math.round(discount * 100) / 100, applicableAmount);
};

// ────────────────────────────────────────
// Check if an item matches offer conditions
// ────────────────────────────────────────
export const isItemApplicable = (item, offer) => {
  if (!offer.conditions) return true;

  const { productIds, categoryIds, subCategoryIds, collectionId, genders } = offer.conditions;
  const product = item.productId;

  // If no specific item conditions, it applies to all items in current scope (merchant/cart)
  const hasItemRestrictions = 
    (productIds && productIds.length > 0) || 
    (categoryIds && categoryIds.length > 0) || 
    (subCategoryIds && subCategoryIds.length > 0) || 
    collectionId || 
    (genders && genders.length > 0);

  if (!hasItemRestrictions) return true;

  // Match Product ID
  if (productIds && productIds.length > 0) {
    const pid = product?._id?.toString() || product?.toString();
    if (productIds.map(id => id.toString()).includes(pid)) return true;
  }

  // Match Collection
  if (collectionId) {
    const collIdStr = collectionId.toString();
    if (product?.collectionIds?.some(id => id.toString() === collIdStr)) return true;
  }

  // Match Category / Sub-Category
  if (categoryIds && categoryIds.length > 0) {
    const catIds = categoryIds.map(id => id.toString());
    const itemCatId = product?.categoryId?.toString();
    const itemSubCatId = product?.subCategoryId?.toString();
    if (catIds.includes(itemCatId) || catIds.includes(itemSubCatId)) return true;
  }

  if (subCategoryIds && subCategoryIds.length > 0) {
    const subCatIds = subCategoryIds.map(id => id.toString());
    const itemSubCatId = product?.subCategoryId?.toString();
    if (subCatIds.includes(itemSubCatId)) return true;
  }

  // Match Gender
  if (genders && genders.length > 0) {
    const itemGenders = product?.gender || [];
    if (itemGenders.some(g => genders.includes(g))) return true;
  }

  return false;
};

// ────────────────────────────────────────
// Check if a single offer is eligible
// ────────────────────────────────────────
export const validateOfferEligibility = async (offer, userId, cartContext) => {
  const now = new Date();

  // 1. Active + time window
  if (!offer.isActive) return { eligible: false, reason: 'Offer is not active' };
  if (offer.startDate > now) return { eligible: false, reason: 'Offer has not started yet' };
  if (offer.endDate <= now) return { eligible: false, reason: 'Offer has expired' };

  // 2. Global usage limit
  if (offer.maxUsageTotal !== null && offer.currentUsage >= offer.maxUsageTotal) {
    return { eligible: false, reason: 'Offer usage limit reached' };
  }

  // 3. Per-user usage limit
  if (userId && offer.maxUsagePerUser) {
    const userUsage = await getUserOfferUsage(userId, offer._id);
    if (userUsage >= offer.maxUsagePerUser) {
      return { eligible: false, reason: 'You have already used this offer' };
    }
  }

  // 4. First-time user check
  if (offer.conditions?.firstTimeUserOnly) {
    if (!userId) return { eligible: false, reason: 'Login required for this offer' };
    const firstTime = await isFirstTimeUser(userId);
    if (!firstTime) return { eligible: false, reason: 'This offer is for first-time users only' };
  }

  // 5. Minimum cart value
  if (offer.conditions?.minCartValue > 0) {
    if ((cartContext.subtotal || 0) < offer.conditions.minCartValue) {
      return {
        eligible: false,
        reason: `Add ₹${offer.conditions.minCartValue - (cartContext.subtotal || 0)} more to avail this offer`,
      };
    }
  }

  // 6. Minimum order value (vendor)
  if (offer.conditions?.minOrderValue > 0) {
    // Check merchant-specific items total
    const merchantTotal = cartContext.merchantTotals?.[offer.merchantId?.toString()] || 0;
    if (merchantTotal < offer.conditions.minOrderValue) {
      return {
        eligible: false,
        reason: `Order ₹${offer.conditions.minOrderValue - merchantTotal} more from this store`,
      };
    }
  }

  // 7. Item-specific filters (Category, Product, Collection, Gender)
  const hasMatchingItem = cartContext.items?.some(item => isItemApplicable(item, offer));
  if (!hasMatchingItem) {
    return { eligible: false, reason: 'No eligible items in cart for this offer' };
  }

  // 8. Merchant match (for merchant-scoped offers)
  if (offer.scope === 'merchant' && offer.merchantId) {
    const merchantIdStr = offer.merchantId.toString();
    const hasItemFromMerchant = cartContext.items?.some(item => {
      const mid = item.merchantId?._id?.toString() || item.merchantId?.toString();
      return mid === merchantIdStr;
    });
    if (!hasItemFromMerchant) {
      return { eligible: false, reason: 'No items from this store in your cart' };
    }
  }

  return { eligible: true };
};

// ────────────────────────────────────────
// Get the applicable amount for an offer
// ────────────────────────────────────────
export const getApplicableAmount = (offer, cartContext) => {
  // If there are item-specific restrictions, only sum matching items
  const { productIds, categoryIds, subCategoryIds, collectionId, genders } = offer.conditions || {};
  const hasItemRestrictions =
    (productIds && productIds.length > 0) ||
    (categoryIds && categoryIds.length > 0) ||
    (subCategoryIds && subCategoryIds.length > 0) ||
    collectionId ||
    (genders && genders.length > 0);

  if (hasItemRestrictions) {
    return (
      cartContext.items?.reduce((sum, item) => {
        if (isItemApplicable(item, offer)) {
          // Double check merchant scope if it's a merchant offer
          if (offer.scope === 'merchant' && offer.merchantId) {
            const mid = offer.merchantId.toString();
            const itemMid = item.merchantId?._id?.toString() || item.merchantId?.toString();
            if (itemMid !== mid) return sum;
          }
          return sum + (item.price || 0) * (item.quantity || 1);
        }
        return sum;
      }, 0) || 0
    );
  }

  // For merchant-specific offers with no item restrictions, only consider that merchant's items
  if (offer.scope === 'merchant' && offer.merchantId) {
    const mid = offer.merchantId.toString();
    return cartContext.items?.reduce((sum, item) => {
      const itemMid = item.merchantId?._id?.toString() || item.merchantId?.toString();
      if (itemMid === mid) {
        return sum + (item.price || 0) * (item.quantity || 1);
      }
      return sum;
    }, 0) || 0;
  }

  // For general offers, apply to entire cart subtotal
  return cartContext.subtotal || 0;
};

// ────────────────────────────────────────
// Calculate offers for cart based on selected offers
// ────────────────────────────────────────
export const findBestOffers = async (userId, cartContext, couponCode = null, selectedOffers = [], orderType = null) => {
  const now = new Date();
  const log = (msg) => {
    console.log(`[OFFER_DEBUG] ${msg}`);
  };
  
  log(`--- NEW REQUEST: findBestOffers userId: ${userId}, couponCode: ${couponCode}, orderType: ${orderType}`);
  log(`Cart Context: ${JSON.stringify(cartContext)}`);

  const query = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gt: now },
  };

  const offers = await Offer.find(query).sort({ priority: -1 }).lean();

  let validOffers = [];
  let explicitCoupon = null;

  for (const offer of offers) {
    // Filter by order type applicability
    if (orderType && offer.applicableTo && offer.applicableTo !== 'both') {
      if (offer.applicableTo !== orderType) {
        log(`Offer ${offer.title} skipped: applicableTo=${offer.applicableTo} doesn't match orderType=${orderType}`);
        continue;
      }
    }

    if (offer.requiresCoupon && offer.couponCode !== couponCode) {
      continue;
    }

    const { eligible, reason } = await validateOfferEligibility(offer, userId, cartContext);
    if (!eligible) {
      log(`Offer ${offer.title} skipped: ineligible. Reason: ${reason}`);
      continue;
    }

    const applicableAmount = getApplicableAmount(offer, cartContext);
    const discount = calculateDiscount(offer, applicableAmount);

    if (discount <= 0 && !offer.freeDelivery) {
      continue;
    }

    let totalValue = discount;
    if (offer.freeDelivery) {
      totalValue += (cartContext.totalDeliveryCharge || 0) + (cartContext.totalReturnCharge || 0);
    }

    const processedOffer = {
      ...offer,
      discountAmount: discount,
      totalValue,
    };

    if (couponCode && offer.couponCode === couponCode) {
      explicitCoupon = processedOffer;
    }

    validOffers.push(processedOffer);
  }

  // --- NEW LOGIC: Manual Selection ---
  // We no longer auto-apply the "best" stack. We only apply what the user selected.
  let winningOffers = [];
  let availableOffers = [...validOffers]; // Return all that are eligible

  const selectedOfferIdsStr = selectedOffers.map(so => {
    if (typeof so === 'string') return so;
    return so.offerId?.toString() || so._id?.toString();
  });

  // Filter valid offers by what the user explicitly selected
  for (const offer of validOffers) {
    if (selectedOfferIdsStr.includes(offer._id.toString())) {
      winningOffers.push(offer);
    }
  }

  // Always apply explicit coupon if valid
  if (explicitCoupon && !winningOffers.find(o => o._id.toString() === explicitCoupon._id.toString())) {
    winningOffers.push(explicitCoupon);
  }

  const finalResult = {
    appliedOffers: winningOffers,
    availableOffers: availableOffers,
    totalDiscount: winningOffers.reduce((sum, o) => sum + o.discountAmount, 0),
    freeDelivery: winningOffers.some(o => o.freeDelivery),
  };
  
  log(`--- FINAL RESULT: ${JSON.stringify(finalResult)}`);
  log(`--- END REQUEST ---`);

  return finalResult;
};

// ────────────────────────────────────────
// Get all available offers for a user
// (for the "Offers" screen in customer app)
// ────────────────────────────────────────
export const getAvailableOffersForUser = async (userId, cartContext = null, orderType = null) => {
  const now = new Date();

  const offers = await Offer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  const result = [];

  for (const offer of offers) {
    const validation = await validateOfferEligibility(offer, userId, cartContext || { items: [], subtotal: 0 });

    // Check order type applicability
    let applicableToOrder = true;
    if (orderType && offer.applicableTo && offer.applicableTo !== 'both') {
      applicableToOrder = offer.applicableTo === orderType;
    }

    result.push({
      ...offer,
      eligible: validation.eligible && applicableToOrder,
      reason: !applicableToOrder
        ? `This offer is only for ${offer.applicableTo === 'try_and_buy' ? 'Try & Buy' : 'Standard Delivery'} orders`
        : (validation.reason || null),
    });
  }

  return result;
};

// ────────────────────────────────────────
// Validate a specific coupon code
// ────────────────────────────────────────
export const validateCouponCode = async (couponCode, userId, cartContext, orderType = null) => {
  const now = new Date();

  const offer = await Offer.findOne({
    couponCode: couponCode.toUpperCase(),
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gt: now },
  }).lean();

  if (!offer) {
    return { valid: false, reason: 'Invalid coupon code' };
  }

  // Check order type applicability
  if (orderType && offer.applicableTo && offer.applicableTo !== 'both') {
    if (offer.applicableTo !== orderType) {
      const label = offer.applicableTo === 'try_and_buy' ? 'Try & Buy' : 'Standard Delivery';
      return { valid: false, reason: `This coupon is only valid for ${label} orders` };
    }
  }

  const validation = await validateOfferEligibility(offer, userId, cartContext);
  if (!validation.eligible) {
    return { valid: false, reason: validation.reason };
  }

  const applicableAmount = getApplicableAmount(offer, cartContext);
  const discount = calculateDiscount(offer, applicableAmount);

  return {
    valid: true,
    offer,
    discountAmount: discount,
  };
};

// ────────────────────────────────────────
// Record offer usage after order placement
// ────────────────────────────────────────
export const recordOfferUsage = async (userId, offerId, orderId, orderModel, discountApplied) => {
  // Create usage record
  await OfferUsage.create({
    userId,
    offerId,
    orderId,
    orderModel,
    discountApplied,
  });

  // Increment global usage counter
  await Offer.findByIdAndUpdate(offerId, {
    $inc: { currentUsage: 1 },
  });
};
