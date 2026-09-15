import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { issueReferralCoupon } from '../helperFns/referralHelper.js';

/**
 * Handle Sign In with Apple
 * Accepts identityToken, Apple user identifier, optional fullName and referralCode
 */
export const appleLogin = asyncHandler(async (req, res) => {
  const { identityToken, user: appleUserId, fullName, referralCode } = req.body || {};

  if (!identityToken) {
    throw new ApiError(400, "Apple Identity Token is required");
  }

  let appleId, email, name;

  // Development mock token support
  if (process.env.NODE_ENV === 'development' && identityToken.startsWith('mock-apple-token-')) {
    const parts = identityToken.split('-');
    appleId = parts[3] || 'mock-apple-id-12345';
    email = parts[4] || 'mockappleuser@example.com';
    name = 'Mock Apple User';
  } else {
    try {
      // Decode the Apple JWT identity token
      const decoded = jwt.decode(identityToken);
      if (!decoded || !decoded.sub) {
        throw new ApiError(401, "Invalid Apple ID token payload");
      }

      appleId = decoded.sub;
      email = decoded.email || '';

      if (fullName) {
        const given = fullName.givenName || '';
        const family = fullName.familyName || '';
        name = `${given} ${family}`.trim();
      }
    } catch (error) {
      console.error("Error decoding Apple ID token:", error.message);
      throw new ApiError(401, "Invalid Apple ID token. Verification failed.");
    }
  }

  // Fallback to client-provided apple user ID if sub is somehow empty
  if (!appleId && appleUserId) {
    appleId = appleUserId;
  }

  if (!appleId) {
    throw new ApiError(400, "Apple User Identifier not found");
  }

  // 1. Check if user already exists by appleId
  let user = await User.findOne({ appleId });

  // 2. If not, check by email (if email was provided)
  if (!user && email) {
    user = await User.findOne({ email });
    if (user) {
      // Link Apple account to existing user account
      user.appleId = appleId;
      if (!user.name && name) {
        user.name = name;
      }
      user.lastLogin = new Date();
      await user.save();
    }
  }

  let isNewUser = false;
  let referrerId = null;

  // 3. If user still does not exist, create new user
  if (!user) {
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        referrerId = referrer._id;
      }
    }

    user = await User.create({
      appleId,
      email: email || '',
      name: name || 'Apple User',
      profilePicture: '',
      isVerified: true, // Apple accounts are pre-verified by Apple
      referredBy: referrerId,
    });
    isNewUser = true;

    // Issue welcome coupon to new user if they used a referral code
    if (referrerId) {
      issueReferralCoupon(user._id, false).catch(err => console.error(err));
    }
  } else {
    // Update existing user's name if missing and last login
    if (!user.name && name) {
      user.name = name;
    }
    user.lastLogin = new Date();
    await user.save();
  }

  // Generate JWT (15 minutes for access, 30 days for refresh)
  const token = jwt.sign(
    { userId: user._id, phoneNumber: user.phoneNumber },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  return res.status(200).json(
    new ApiResponse(200, {
      token,
      refreshToken,
      userId: user._id,
      isNewUser,
    }, "Apple Authentication successful")
  );
});
