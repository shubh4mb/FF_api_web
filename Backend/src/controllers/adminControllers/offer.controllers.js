import Offer from '../../models/offer.model.js';

/**
 * ── Admin Offer Controllers ──
 * Full CRUD for admin-scoped offers:
 *   FIRST_TIME_USER, CART_VALUE, CATEGORY, FLASH_SALE, COLLECTION
 */

const ADMIN_OFFER_TYPES = ['FIRST_TIME_USER', 'CART_VALUE', 'CATEGORY', 'FLASH_SALE', 'COLLECTION'];

// ── Create Offer ──
export const createOffer = async (req, res) => {
  try {
    const {
      title, description, badgeText, type,
      discountType, discountValue, maxDiscount,
      conditions, startDate, endDate, isFlashSale,
      couponCode, requiresCoupon,
      maxUsageTotal, maxUsagePerUser,
      freeDelivery, priority,
    } = req.body;

    if (!ADMIN_OFFER_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid offer type for admin. Allowed: ${ADMIN_OFFER_TYPES.join(', ')}`,
      });
    }

    if (!title || !discountType || discountValue === undefined || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, discountType, discountValue, endDate',
      });
    }

    // Check coupon code uniqueness if provided
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
      scope: 'admin',
      createdBy: req.adminId,
      createdByModel: 'Admin',
      merchantId: null,
      discountType,
      discountValue,
      maxDiscount: maxDiscount || null,
      conditions: {
        minCartValue: conditions?.minCartValue || 0,
        categoryIds: conditions?.categoryIds || [],
        subCategoryIds: conditions?.subCategoryIds || [],
        productIds: conditions?.productIds || [],
        collectionId: conditions?.collectionId || null,
        genders: conditions?.genders || [],
        firstTimeUserOnly: type === 'FIRST_TIME_USER' ? true : (conditions?.firstTimeUserOnly || false),
        minOrderValue: conditions?.minOrderValue || 0,
      },
      startDate: startDate || new Date(),
      endDate,
      isFlashSale: type === 'FLASH_SALE' ? true : (isFlashSale || false),
      couponCode: couponCode || null,
      requiresCoupon: requiresCoupon || false,
      maxUsageTotal: maxUsageTotal || null,
      maxUsagePerUser: maxUsagePerUser || 1,
      freeDelivery: freeDelivery || false,
      priority: priority || 0,
      benefitType: req.body.benefitType || (type === 'COLLECTION' ? 'PRODUCT' : 'CART'),
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
    console.error('[Admin] Create offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get All Offers ──
export const getAllOffers = async (req, res) => {
  try {
    const { type, isActive, page = 1, limit = 20 } = req.query;

    const filter = { scope: 'admin' };
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const total = await Offer.countDocuments(filter);
    const offers = await Offer.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      offers,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Admin] Get offers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Offer By ID ──
export const getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).lean();
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    return res.status(200).json({ success: true, offer });
  } catch (error) {
    console.error('[Admin] Get offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Update Offer ──
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow changing scope
    delete updates.scope;
    delete updates.createdBy;
    delete updates.createdByModel;

    // If updating coupon code, check uniqueness
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

    const offer = await Offer.findByIdAndUpdate(id, updates, { new: true });
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      offer,
    });
  } catch (error) {
    console.error('[Admin] Update offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Toggle Offer Active/Inactive ──
export const toggleOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    return res.status(200).json({
      success: true,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'}`,
      offer,
    });
  } catch (error) {
    console.error('[Admin] Toggle offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Delete Offer ──
export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Offer deleted successfully',
    });
  } catch (error) {
    console.error('[Admin] Delete offer error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get All Offers (including merchant) for admin overview ──
export const getAllOffersOverview = async (req, res) => {
  try {
    const { scope, type, isActive, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (scope) filter.scope = scope;
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const total = await Offer.countDocuments(filter);
    const offers = await Offer.find(filter)
      .populate('merchantId', 'shopName')
      .sort({ priority: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      offers,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[Admin] Overview offers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
