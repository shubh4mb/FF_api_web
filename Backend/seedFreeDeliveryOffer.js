import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Offer from './src/models/offer.model.js';

const seedFreeDeliveryOffer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('No MONGODB_URI found in environment!');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // Look for existing FREEDELIVERY coupon or FREE_DELIVERY offer
    const filter = {
      $or: [
        { couponCode: 'FREEDELIVERY' },
        { type: 'FREE_DELIVERY' }
      ]
    };

    const updateData = {
      title: 'Free Delivery Coupon',
      description: 'Enjoy 100% Free Delivery, Free Doorstep Returns, and Free Waiting Time on your order!',
      badgeText: 'FREE DELIVERY & RETURNS',
      type: 'FREE_DELIVERY',
      scope: 'admin',
      applicableTo: 'both',
      benefitType: 'DELIVERY',
      discountType: 'flat',
      discountValue: 0,
      couponCode: 'FREEDELIVERY',
      requiresCoupon: false,
      autoApply: true,
      isPublic: true,
      stackable: true,
      isExclusive: false,
      freeDelivery: true,
      freeReturn: true,
      freeWaiting: true,
      conditions: {
        minCartValue: 0,
        minOrderValue: 0,
        firstTimeUserOnly: false,
        categoryIds: [],
        subCategoryIds: [],
        productIds: [],
        genders: [],
      },
      maxUsagePerUser: null, // Unlimited for all users
      maxUsageTotal: null,   // Unlimited total usage
      startDate: new Date('2025-01-01'),
      endDate: new Date('2035-12-31'),
      isActive: true,
      priority: 100,
    };

    const offer = await Offer.findOneAndUpdate(
      filter,
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('----------------------------------------------------');
    console.log('FlashFits Free Delivery Coupon Upserted Successfully:');
    console.log(`- ID: ${offer._id}`);
    console.log(`- Title: ${offer.title}`);
    console.log(`- Coupon Code: ${offer.couponCode}`);
    console.log(`- Type: ${offer.type}`);
    console.log(`- Requires Coupon: ${offer.requiresCoupon}`);
    console.log(`- Auto Apply: ${offer.autoApply}`);
    console.log(`- Free Delivery: ${offer.freeDelivery}`);
    console.log(`- Free Return: ${offer.freeReturn}`);
    console.log(`- Free Waiting: ${offer.freeWaiting}`);
    console.log(`- Conditions: minCartValue=${offer.conditions?.minCartValue}, firstTimeUserOnly=${offer.conditions?.firstTimeUserOnly}`);
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding Free Delivery offer:', err);
    process.exit(1);
  }
};

seedFreeDeliveryOffer();
