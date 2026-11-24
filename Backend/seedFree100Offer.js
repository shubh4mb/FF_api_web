import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

import Offer from './src/models/offer.model.js';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

async function seedFree100Coupon() {
  try {
    if (!uri) {
      console.error('No MONGO_URI or MONGODB_URI found in environment.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const couponCode = 'FREE100';

    // Remove any existing FREE100 coupon to avoid duplicates or conflict
    const deleted = await Offer.deleteMany({ couponCode: couponCode });
    if (deleted.deletedCount > 0) {
      console.log(`Deleted ${deleted.deletedCount} existing offer(s) with code ${couponCode}.`);
    }

    const now = new Date();
    const tenYearsLater = new Date();
    tenYearsLater.setFullYear(now.getFullYear() + 10);

    const newOffer = await Offer.create({
      title: 'Flat ₹100 OFF',
      description: 'Get Flat ₹100 OFF on your Try & Buy order with no minimum order value.',
      badgeText: 'FLAT ₹100 OFF',
      type: 'CART_VALUE',
      scope: 'admin',
      applicableTo: 'try_and_buy',       // Try & Buy orders only
      benefitType: 'CART',
      discountType: 'flat',             // Flat ₹100 off
      discountValue: 100,
      maxDiscount: null,
      conditions: {
        minCartValue: 0,                // No minimum condition
        minOrderValue: 0,
        categoryIds: [],
        subCategoryIds: [],
        productIds: [],
        genders: [],
        firstTimeUserOnly: false,       // Applicable to everyone (new and existing users)
      },
      startDate: now,
      endDate: tenYearsLater,
      isFlashSale: false,
      couponCode: couponCode,           // FREE100
      requiresCoupon: true,             // Enter code or select from offers
      isPublic: true,                   // Visible in customer app coupon list
      autoApply: false,
      maxUsageTotal: null,              // Unlimited total redemptions
      maxUsagePerUser: null,            // Unlimited redemptions per user
      freeDelivery: false,
      freeReturn: false,
      freeWaiting: false,
      priority: 50,
      stackable: true,
      isExclusive: false,
      isActive: true,
    });

    console.log('SUCCESS: Created FREE100 coupon:', {
      id: newOffer._id,
      title: newOffer.title,
      couponCode: newOffer.couponCode,
      applicableTo: newOffer.applicableTo,
      discountType: newOffer.discountType,
      discountValue: newOffer.discountValue,
      minCartValue: newOffer.conditions.minCartValue,
      maxUsagePerUser: newOffer.maxUsagePerUser,
      maxUsageTotal: newOffer.maxUsageTotal,
      startDate: newOffer.startDate,
      endDate: newOffer.endDate,
    });

    process.exit(0);
  } catch (err) {
    console.error('Error creating FREE100 coupon:', err);
    process.exit(1);
  }
}

seedFree100Coupon();
