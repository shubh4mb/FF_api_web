// src/helperFns/referralHelper.js
import Offer from '../models/offer.model.js';
import User from '../models/user.model.js';
import { notifyCustomer } from './notificationHelper.js';
import crypto from 'crypto';

/**
 * Issues a 60-day Free Delivery coupon to a user.
 * @param {string} userId - The ID of the user receiving the coupon.
 * @param {boolean} isReferrer - Whether the user is the referrer (true) or new user (false).
 */
export const issueReferralCoupon = async (userId, isReferrer = true) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    // Generate a clean 6-character coupon code
    const uniqueStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    const prefix = isReferrer ? 'REF' : 'NEW';
    const couponCode = `${prefix}-FREEDEL-${uniqueStr}`;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 60); // Valid for 60 days

    // Create the personalized offer
    const offer = await Offer.create({
      title: isReferrer ? 'Referral Reward: Free Delivery' : 'Welcome Gift: Free Delivery',
      description: isReferrer
        ? 'You earned a Free Delivery coupon because your referred friend completed their order!'
        : 'Enjoy free delivery on your order.',
      badgeText: 'FREE DELIVERY',
      type: 'FREE_DELIVERY',
      scope: 'admin',
      applicableTo: 'both',
      benefitType: 'DELIVERY',
      stackable: true,
      discountType: 'flat',
      discountValue: 0,
      freeDelivery: true,
      freeReturn: true,
      freeWaiting: true,
      startDate,
      endDate,
      couponCode,
      requiresCoupon: true,
      isPublic: false,
      targetUserId: user._id,
      maxUsageTotal: 1,
      maxUsagePerUser: 1,
      priority: 150,
      isActive: true,
    });

    // Notify the user via push/in-app notification
    await notifyCustomer({
      userId,
      type: 'info',
      title: 'Free Delivery Reward! 🎁',
      body: isReferrer
        ? `Your friend completed their order! Use coupon ${couponCode} for Free Delivery on your next order.`
        : `Use coupon ${couponCode} for Free Delivery on your order.`,
      data: { couponCode },
    });

    console.log(`[Referral Reward] Successfully issued ${couponCode} to user ${userId}`);
    return offer;
  } catch (error) {
    console.error('Error issuing referral coupon:', error);
    return null;
  }
};

/**
 * Handles logic when a user completes an order.
 * If this is the referred user's first completed order, the referrer gets a free delivery coupon.
 * @param {string} newUserId - The ID of the user who completed the order.
 */
export const handleFirstOrderCompletion = async (newUserId) => {
  try {
    const user = await User.findById(newUserId);
    if (!user || !user.referredBy || user.referralRewardIssued) {
      return;
    }

    // Atomically mark reward issued so it only ever triggers once
    const updated = await User.findOneAndUpdate(
      { _id: newUserId, referralRewardIssued: { $ne: true } },
      { $set: { referralRewardIssued: true } },
      { new: true }
    );

    if (!updated) {
      return;
    }

    console.log(`[Referral Reward] Friend ${newUserId} completed first order. Rewarding referrer ${user.referredBy}...`);

    // Issue the free delivery coupon to the referrer
    await issueReferralCoupon(user.referredBy, true);
  } catch (error) {
    console.error('Error handling first order completion referral reward:', error);
  }
};
