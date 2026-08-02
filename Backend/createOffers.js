import mongoose from 'mongoose';
import Offer from './src/models/offer.model.js';
import Merchant from './src/models/merchant.model.js';

const uri = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(uri);
    
    const wrongMerchantId = '6a5e4ffd0906bf3164ab4df9'; // Flashfits Kaloor (Warehouse)
    const rightMerchantId = '6a52c077f5d225d81a327965'; // SB Fashion (shubhamhome@gmail.com)

    // Delete from wrong merchant
    const deleted = await Offer.deleteMany({ merchantId: wrongMerchantId });
    console.log(`Deleted ${deleted.deletedCount} offers from the wrong merchant (shubhamwarehouse).`);

    const sbFashion = await Merchant.findById(rightMerchantId);
    if (!sbFashion) {
      console.log("Merchant not found.");
      process.exit(1);
    }

    console.log("Creating offers for Merchant:", sbFashion.shopName);

    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(now.getMonth() + 1);

    const offers = [
      {
        title: "SB Fashion Public Discount - 20% OFF",
        description: "Get 20% OFF on your order with SB Fashion.",
        badgeText: "20% OFF",
        type: "VENDOR_DISCOUNT",
        scope: "merchant",
        applicableTo: "both",
        benefitType: "CART",
        stackable: false,
        createdByModel: "Merchant",
        createdBy: sbFashion._id,
        merchantId: sbFashion._id,
        discountType: "percentage",
        discountValue: 20,
        maxDiscount: 300,
        conditions: {
          minOrderValue: 200
        },
        startDate: now,
        endDate: nextMonth,
        isFlashSale: false,
        requiresCoupon: true,
        couponCode: "SBFASHION20",
        isPublic: true,
        maxUsagePerUser: 1,
        priority: 10,
        isActive: true
      },
      {
        title: "SB Fashion Flat ₹100 OFF",
        description: "Flat ₹100 OFF on orders above ₹499.",
        badgeText: "₹100 OFF",
        type: "VENDOR_DISCOUNT",
        scope: "merchant",
        applicableTo: "both",
        benefitType: "CART",
        stackable: false,
        createdByModel: "Merchant",
        createdBy: sbFashion._id,
        merchantId: sbFashion._id,
        discountType: "flat",
        discountValue: 100,
        conditions: {
          minOrderValue: 499
        },
        startDate: now,
        endDate: nextMonth,
        isFlashSale: false,
        requiresCoupon: true,
        couponCode: "SBFASHION100",
        isPublic: true,
        maxUsagePerUser: 1,
        priority: 15,
        isActive: true
      },
      {
        title: "SB Secret VIP 30% OFF Coupon",
        description: "Exclusive secret 30% discount for VIP customers.",
        badgeText: "VIP SECRET",
        type: "VENDOR_DISCOUNT",
        scope: "merchant",
        applicableTo: "both",
        benefitType: "CART",
        stackable: false,
        createdByModel: "Merchant",
        createdBy: sbFashion._id,
        merchantId: sbFashion._id,
        discountType: "percentage",
        discountValue: 30,
        maxDiscount: 600,
        conditions: {
          minOrderValue: 300
        },
        startDate: now,
        endDate: nextMonth,
        isFlashSale: false,
        requiresCoupon: true,
        couponCode: "VIPFASHION30",
        isPublic: false,
        maxUsagePerUser: 1,
        priority: 25,
        isActive: true
      },
      {
        title: "SB Hidden Secret Promo ₹150 OFF",
        description: "Private secret coupon code for special promotions.",
        badgeText: "PRIVATE PROMO",
        type: "VENDOR_DISCOUNT",
        scope: "merchant",
        applicableTo: "both",
        benefitType: "CART",
        stackable: false,
        createdByModel: "Merchant",
        createdBy: sbFashion._id,
        merchantId: sbFashion._id,
        discountType: "flat",
        discountValue: 150,
        conditions: {
          minOrderValue: 500
        },
        startDate: now,
        endDate: nextMonth,
        isFlashSale: false,
        requiresCoupon: true,
        couponCode: "SECRET150",
        isPublic: false,
        maxUsagePerUser: 1,
        priority: 30,
        isActive: true
      }
    ];

    for (const offer of offers) {
      await Offer.findOneAndUpdate(
        { title: offer.title, merchantId: offer.merchantId }, 
        offer, 
        { upsert: true, new: true }
      );
      console.log(`Created/Updated offer: ${offer.title}`);
    }

    console.log(`Successfully created offers for ${sbFashion.shopName}.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
