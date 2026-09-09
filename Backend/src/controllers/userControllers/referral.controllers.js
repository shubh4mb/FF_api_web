import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import User from '../../models/user.model.js';
import Offer from '../../models/offer.model.js';

export const getReferralStats = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?._id || req.user?.id;

  let user = await User.findById(userId);
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, 'User not found'));
  }

  // If user doesn't have a referral code yet (e.g. legacy user), generate and assign one
  if (!user.referralCode) {
    let isUnique = false;
    let newCode = '';
    while (!isUnique) {
      newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existing = await User.findOne({ referralCode: newCode });
      if (!existing) {
        isUnique = true;
      }
    }
    user.referralCode = newCode;
    await User.findByIdAndUpdate(userId, { referralCode: newCode });
  }

  // Count how many users registered with this user's referral code
  const referredUsersCount = await User.countDocuments({ referredBy: userId });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        referralCode: user.referralCode,
        referredUsersCount,
      },
      'Referral stats fetched successfully'
    )
  );
});
