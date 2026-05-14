import Offer from '../../models/offer.model.js';
import {
  getAvailableOffersForUser,
  findBestOffers,
  validateCouponCode,
} from '../../services/offerEngine.js';

/**
 * ── User Offer Controllers ──
 * Customer-facing endpoints for discovering and applying offers.
 */

// ── Get Available Offers ──
// Returns all offers with eligibility status for the user
export const getAvailableOffers = async (req, res) => {
  try {
    const userId = req.user?.userId || null;
    const { subtotal, merchantId, orderType } = req.query;

    // Build a minimal cart context from query params
    const cartContext = {
      items: [],
      subtotal: Number(subtotal) || 0,
    };

    const offers = await getAvailableOffersForUser(userId, cartContext, orderType || null);

    // If merchantId filter, also include that merchant's offers
    let filteredOffers = offers;
    if (merchantId) {
      filteredOffers = offers.filter(o =>
        o.scope === 'admin' ||
        (o.scope === 'merchant' && o.merchantId?.toString() === merchantId)
      );
    }

    return res.status(200).json({
      success: true,
      offers: filteredOffers,
    });
  } catch (error) {
    console.error('[User] Get offers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Apply Coupon Code ──
export const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { couponCode, cartContext, orderType } = req.body;

    if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const result = await validateCouponCode(couponCode, userId, cartContext || { items: [], subtotal: 0 }, orderType || null);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.reason,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      offer: {
        _id: result.offer._id,
        title: result.offer.title,
        description: result.offer.description,
        discountType: result.offer.discountType,
        discountValue: result.offer.discountValue,
        scope: result.offer.scope,
        badgeText: result.offer.badgeText,
      },
      discountAmount: result.discountAmount,
    });
  } catch (error) {
    console.error('[User] Apply coupon error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Offers for a Merchant Store Page ──
export const getOffersByMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const now = new Date();

    const offers = await Offer.find({
      merchantId,
      scope: 'merchant',
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now },
    })
      .sort({ priority: -1 })
      .lean();

    return res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error('[User] Get merchant offers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Active Flash Sales ──
export const getFlashSales = async (req, res) => {
  try {
    const now = new Date();

    const flashSales = await Offer.find({
      isFlashSale: true,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now },
    })
      .sort({ endDate: 1 })   // Ending soonest first
      .lean();

    return res.status(200).json({ success: true, offers: flashSales });
  } catch (error) {
    console.error('[User] Get flash sales error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Best Offers for Cart ──
// Called by cart screen to show auto-applied + available offers
export const getBestOffersForCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cartContext, couponCode, orderType } = req.body;

    const result = await findBestOffers(userId, cartContext || { items: [], subtotal: 0 }, couponCode || null, [], orderType || null);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[User] Get best offers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Promotional Banners for Homepage ──
export const getPromotionalBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now },
      badgeText: { $ne: '' }, // Often used for top promos
      'bannerImage.url': { $exists: true, $ne: null },
    })
    .sort({ priority: -1, createdAt: -1 })
    .select('title bannerImage conditions collectionId badgeText')
    .lean();

    return res.status(200).json({ success: true, banners });
  } catch (error) {
    console.error('[User] Get promotional banners error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
