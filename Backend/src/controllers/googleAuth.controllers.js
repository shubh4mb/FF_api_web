import { OAuth2Client } from 'google-auth-library';
import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!clientId || clientId === 'PLACEHOLDER_GOOGLE_WEB_CLIENT_ID') {
    // In local placeholder setup, don't crash but return a warning if invoked
    console.warn("WARNING: GOOGLE_WEB_CLIENT_ID is not configured yet in .env");
  }
  return new OAuth2Client(clientId);
};

export const googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new ApiError(400, "Google ID Token is required");
  }

  let googleId, email, name, picture;

  // Bypass signature verification if using a placeholder token in local development
  if (process.env.NODE_ENV === 'development' && idToken.startsWith('mock-google-token-')) {
    const parts = idToken.split('-');
    googleId = parts[3] || 'mock-google-id-12345';
    email = parts[4] || 'mockuser@example.com';
    name = 'Mock Google User';
    picture = '';
    console.log("Using Mock Google Authentication for development testing.");
  } else {
    try {
      const client = getOAuthClient();
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new ApiError(401, "Invalid Google ID token payload");
      }

      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } catch (error) {
      console.error("Error verifying Google ID token:", error.message);
      throw new ApiError(401, "Invalid Google ID token. Verification failed.");
    }
  }

  if (!email) {
    throw new ApiError(400, "Email address not provided by Google account");
  }

  // 1. Check if user already exists by googleId
  let user = await User.findOne({ googleId });

  // 2. If not, check by email
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      // Link Google account to existing user account
      user.googleId = googleId;
      if (!user.profilePicture) {
        user.profilePicture = picture || '';
      }
      user.lastLogin = new Date();
      await user.save();
    }
  }

  let isNewUser = false;
  // 3. If still doesn't exist, create a new user
  if (!user) {
    user = await User.create({
      googleId,
      email,
      name: name || '',
      profilePicture: picture || '',
      isVerified: true, // Google accounts are pre-verified
    });
    isNewUser = true;
  } else {
    // Update existing user's last login
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
    }, "Google Authentication successful")
  );
});
