// src/helperFns/referralHelper.js
import Offer from '../models/offer.model.js';
import User from '../models/user.model.js';
import { notifyCustomer } from './notificationHelper.js';
import crypto from 'crypto';

/**
 * Issues a 14-day Free Delivery coupon to a user.
 * @param {string} userId - The ID of the user receiving the coupon.
 * @param {boolean} isReferrer - Whether the user is the referrer (true) or the new user (false).
 */
export const issueReferralCoupon = async (userId, isReferrer = false) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    // Generate a unique 8-character coupon code
    const uniqueStr = crypto.randomBytes(4).toString('hex').toUpperCase();
    const prefix = isReferrer ? 'REF' : 'NEW';
    const couponCode = `${prefix}-FREEDEL-${uniqueStr}`;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14); // Valid for 14 days

    // Create the offer
    const offer = await Offer.create({
      title: isReferrer ? 'Referral Reward: Free Delivery' : 'Welcome Gift: Free Delivery',
      description: isReferrer
        ? 'You earned a free delivery coupon because your friend completed their first order!'
        : 'Welcome! Enjoy free delivery on your first order.',
      badgeText: 'FREE DELIVERY',
      type: 'FIRST_TIME_USER', // Using existing enum
      scope: 'admin',
      applicableTo: 'both',
      benefitType: 'DELIVERY',
      stackable: true,
      discountType: 'flat',
      discountValue: 0,
      freeDelivery: true,
      startDate,
      endDate,
      couponCode,
      requiresCoupon: true,
      isPublic: false,
      maxUsageTotal: 1,
      maxUsagePerUser: 1,
    });

    // Notify the user
    await notifyCustomer({
      userId,
      type: 'info',
      title: 'Free Delivery Coupon! 🎁',
      body: isReferrer
        ? `Your friend completed their first order! Use code ${couponCode} for Free Delivery.`
        : `Welcome! Use code ${couponCode} for Free Delivery on your first order.`,
      data: { couponCode },
    });

    return offer;
  } catch (error) {
    console.error('Error issuing referral coupon:', error);
    return null;
  }
};

/**
 * Handles logic when a user completes an order.
 * If it's their first order and they were referred, the referrer gets a coupon.
 * @param {string} newUserId - The ID of the user who completed the order.
 */
export const handleFirstOrderCompletion = async (newUserId) => {
  try {
    const user = await User.findById(newUserId);
    if (!user || !user.referredBy) return;

    // Issue the coupon to the referrer
    await issueReferralCoupon(user.referredBy, true);
  } catch (error) {
    console.error('Error handling first order completion referral reward:', error);
  }
};
