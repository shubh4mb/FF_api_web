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

  // 7. Category filter
  if (offer.conditions?.categoryIds?.length > 0) {
    const catIds = offer.conditions.categoryIds.map(c => c.toString());
    const hasMatchingItem = cartContext.items?.some(item => {
      const itemCatId = item.categoryId?.toString();
      const itemSubCatId = item.subCategoryId?.toString();
      return catIds.includes(itemCatId) || catIds.includes(itemSubCatId);
    });
    if (!hasMatchingItem) {
      return { eligible: false, reason: 'No eligible items in cart for this offer' };
    }
  }

  // 8. Gender filter
  if (offer.conditions?.genders?.length > 0) {
    const hasMatchingGender = cartContext.items?.some(item => {
      const itemGenders = item.gender || [];
      return itemGenders.some(g => offer.conditions.genders.includes(g));
    });
    if (!hasMatchingGender) {
      return { eligible: false, reason: 'No eligible items for this gender-based offer' };
    }
  }

  // 9. Merchant match (for merchant-scoped offers)
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
const getApplicableAmount = (offer, cartContext) => {
  // For category-based offers, only consider items matching the category
  if (offer.conditions?.categoryIds?.length > 0) {
    const catIds = offer.conditions.categoryIds.map(c => c.toString());
    return cartContext.items?.reduce((sum, item) => {
      const itemCatId = item.categoryId?.toString();
      const itemSubCatId = item.subCategoryId?.toString();
      if (catIds.includes(itemCatId) || catIds.includes(itemSubCatId)) {
        return sum + (item.price || 0) * (item.quantity || 1);
      }
      return sum;
    }, 0) || 0;
  }

  // For merchant-specific offers, only consider that merchant's items
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
// Find best offers (one admin + one merchant)
// ────────────────────────────────────────
export const findBestOffers = async (userId, cartContext, couponCode = null) => {
  const now = new Date();
  const logStream = fs.createWriteStream('debug_offers.log', { flags: 'a' });
  const log = (msg) => {
    logStream.write(`[${new Date().toISOString()}] ${msg}\n`);
    console.log(`[OFFER_DEBUG] ${msg}`);
  };
  
  log(`--- NEW REQUEST: findBestOffers userId: ${userId}, couponCode: ${couponCode}`);
  log(`Cart Context: ${JSON.stringify(cartContext)}`);

  // Fetch all currently active and valid offers
  const query = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gt: now },
  };

  // If no coupon provided, only get auto-apply offers
  // If coupon provided, also include that specific coupon offer
  const offers = await Offer.find(query).sort({ priority: -1 }).lean();

  let bestAdmin = null;
  let bestAdminDiscount = 0;
  let bestMerchant = null;
  let bestMerchantDiscount = 0;
  let couponOffer = null;
  let couponDiscount = 0;

  for (const offer of offers) {
    // Skip coupon-only offers if no coupon provided for them
    if (offer.requiresCoupon && offer.couponCode !== couponCode) {
      log(`Offer ${offer.title} skipped: requiresCoupon true but code mismatch.`);
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
      log(`Offer ${offer.title} skipped: discount <= 0 and not freeDelivery.`);
      continue;
    }

    log(`Offer ${offer.title} passed all checks! (discount: ${discount}, freeDelivery: ${!!offer.freeDelivery})`);

    // Calculate true value of offer (including delivery savings if applicable)
    let totalValue = discount;
    if (offer.freeDelivery) {
      const deliverySavings = (cartContext.totalDeliveryCharge || 0) + (cartContext.totalReturnCharge || 0);
      totalValue += deliverySavings;
    }

    // If this is the coupon the user submitted
    if (couponCode && offer.couponCode === couponCode) {
      couponOffer = offer;
      couponDiscount = discount;
      continue;
    }

    // Find best per scope based on TOTAL value, but we only store the item discount for UI
    if (offer.scope === 'admin') {
      const currentBestValue = bestAdminDiscount + (bestAdmin && bestAdmin.freeDelivery ? ((cartContext.totalDeliveryCharge || 0) + (cartContext.totalReturnCharge || 0)) : 0);
      if (totalValue > currentBestValue || bestAdmin === null) {
        log(`=> bestAdmin replaced by ${offer.title} (totalValue: ${totalValue})`);
        bestAdmin = offer;
        bestAdminDiscount = discount; // Store just item discount
      }
    } else if (offer.scope === 'merchant') {
      const currentBestValue = bestMerchantDiscount + (bestMerchant && bestMerchant.freeDelivery ? ((cartContext.totalDeliveryCharge || 0) + (cartContext.totalReturnCharge || 0)) : 0);
      if (totalValue > currentBestValue || bestMerchant === null) {
        log(`=> bestMerchant replaced by ${offer.title} (totalValue: ${totalValue})`);
        bestMerchant = offer;
        bestMerchantDiscount = discount; // Store just item discount
      }
    }
  }

  // If coupon was provided, it replaces the best offer of its scope
  if (couponOffer) {
    if (couponOffer.scope === 'admin') {
      bestAdmin = couponOffer;
      bestAdminDiscount = couponDiscount;
      log(`=> Overwriting bestAdmin with couponOffer`);
    } else {
      bestMerchant = couponOffer;
      bestMerchantDiscount = couponDiscount;
      log(`=> Overwriting bestMerchant with couponOffer`);
    }
  }

  const finalResult = {
    adminOffer: bestAdmin ? {
      ...bestAdmin,
      discountAmount: bestAdminDiscount,
    } : null,
    merchantOffer: bestMerchant ? {
      ...bestMerchant,
      discountAmount: bestMerchantDiscount,
    } : null,
    totalDiscount: bestAdminDiscount + bestMerchantDiscount,
    freeDelivery: !!((bestAdmin && bestAdmin.freeDelivery) || (bestMerchant && bestMerchant.freeDelivery)),
  };
  
  log(`--- FINAL RESULT: ${JSON.stringify(finalResult)}\n`);
  logStream.end();

  return finalResult;
};

// ────────────────────────────────────────
// Get all available offers for a user
// (for the "Offers" screen in customer app)
// ────────────────────────────────────────
export const getAvailableOffersForUser = async (userId, cartContext = null) => {
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

    result.push({
      ...offer,
      eligible: validation.eligible,
      reason: validation.reason || null,
    });
  }

  return result;
};

// ────────────────────────────────────────
// Validate a specific coupon code
// ────────────────────────────────────────
export const validateCouponCode = async (couponCode, userId, cartContext) => {
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
