import Offer from '../../models/offer.model.js';

/**
 * ── Merchant Offer Controllers ──
 * CRUD for merchant-scoped offers:
 *   VENDOR_DISCOUNT, VENDOR_MIN_ORDER, VENDOR_CLEARANCE
 */

const MERCHANT_OFFER_TYPES = ['VENDOR_DISCOUNT', 'VENDOR_MIN_ORDER', 'VENDOR_CLEARANCE'];

// ── Create Merchant Offer ──
export const createMerchantOffer = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const {
      title, description, badgeText, type,
      discountType, discountValue, maxDiscount,
      conditions, startDate, endDate,
      couponCode, requiresCoupon,
      maxUsageTotal, maxUsagePerUser,
      freeDelivery, priority,
    } = req.body;

    if (!MERCHANT_OFFER_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid offer type for merchants. Allowed: ${MERCHANT_OFFER_TYPES.join(', ')}`,
      });
    }

    if (!title || !discountType || discountValue === undefined || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, discountType, discountValue, endDate',
      });
    }

    // Coupon uniqueness
    if (couponCode) {
      const existing = await Offer.findOne({ couponCode: couponCode.toUpperCase(), isActive: true });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'This coupon code is already in use',
        });
      }
    }

    const offer = await Offer.create({
      title,
      description: description || '',
      badgeText: badgeText || '',
      type,
      scope: 'merchant',
      createdBy: merchantId,
      createdByModel: 'Merchant',
      merchantId,
      discountType,
      discountValue,
      maxDiscount: maxDiscount || null,
      conditions: {
        minCartValue: conditions?.minCartValue || 0,
        categoryIds: conditions?.categoryIds || [],
        subCategoryIds: conditions?.subCategoryIds || [],
        productIds: conditions?.productIds || [],
        genders: conditions?.genders || [],
        firstTimeUserOnly: false,
        minOrderValue: conditions?.minOrderValue || 0,
      },
      startDate: startDate || new Date(),
      endDate,
      isFlashSale: false,
      couponCode: couponCode || null,
      requiresCoupon: requiresCoupon || false,
      maxUsageTotal: maxUsageTotal || null,
      maxUsagePerUser: maxUsagePerUser || 1,
      freeDelivery: freeDelivery || false,
      priority: priority || 0,
      benefitType: req.body.benefitType || 'CART',
      stackable: req.body.stackable !== undefined ? req.body.stackable : true,
      isExclusive: req.body.isExclusive || false,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      offer,
    });
  } catch (error) {
    console.error('[Merchant] Create offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get My Offers ──
export const getMyOffers = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const { isActive } = req.query;

    const filter = { merchantId, scope: 'merchant' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const offers = await Offer.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      offers,
    });
  } catch (error) {
    console.error('[Merchant] Get offers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Update Merchant Offer ──
export const updateMerchantOffer = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const { id } = req.params;
    const updates = req.body;

    // Prevent changing ownership
    delete updates.scope;
    delete updates.createdBy;
    delete updates.merchantId;

    const offer = await Offer.findOne({ _id: id, merchantId });
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found or not yours' });
    }

    // Coupon uniqueness check
    if (updates.couponCode) {
      const existing = await Offer.findOne({
        couponCode: updates.couponCode.toUpperCase(),
        isActive: true,
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'This coupon code is already in use',
        });
      }
    }

    Object.assign(offer, updates);
    await offer.save();

    return res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      offer,
    });
  } catch (error) {
    console.error('[Merchant] Update offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Toggle Merchant Offer ──
export const toggleMerchantOffer = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const offer = await Offer.findOne({ _id: req.params.id, merchantId });
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found or not yours' });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    return res.status(200).json({
      success: true,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'}`,
      offer,
    });
  } catch (error) {
    console.error('[Merchant] Toggle offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Delete Merchant Offer ──
export const deleteMerchantOffer = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const offer = await Offer.findOneAndDelete({ _id: req.params.id, merchantId });
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found or not yours' });
    }

    return res.status(200).json({
      success: true,
      message: 'Offer deleted successfully',
    });
  } catch (error) {
    console.error('[Merchant] Delete offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
