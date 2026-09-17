// src/controllers/auth.controllers.js
import twilio from 'twilio';
import otpGenerator from 'otp-generator';
import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import OTPModel from '../models/otp.model.js';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { issueReferralCoupon } from '../helperFns/referralHelper.js';
import { sendOtpEmail } from '../services/mail.service.js';

// ── Twilio client (lazy init to fail gracefully if creds missing) ────
let twilioClient = null;
const getTwilioClient = () => {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new ApiError(500, "Twilio credentials are not configured on the server");
    }
    twilioClient = new twilio(sid, token);
  }
  return twilioClient;
};

// ── Phone format validation (Indian: +91 followed by 10 digits) ──────
const PHONE_REGEX = /^\+91[6-9]\d{9}$/;

const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    throw new ApiError(400, "Phone number is required");
  }
  const cleaned = phone.replace(/\s+/g, '');
  if (!PHONE_REGEX.test(cleaned)) {
    throw new ApiError(400, "Invalid phone number format. Expected: +91XXXXXXXXXX (10-digit Indian mobile number)");
  }
  return cleaned;
};

// ── Email format validation ──────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    throw new ApiError(400, "Email address is required");
  }
  const cleaned = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleaned)) {
    throw new ApiError(400, "Invalid email address format");
  }
  return cleaned;
};

// ── Constants ─────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 30; // Minimum gap between OTP requests

// ══════════════════════════════════════════════════════════════════════
//  SEND OTP
// ══════════════════════════════════════════════════════════════════════
const sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const cleanPhone = validatePhone(phone);

  // ── Rate limit: prevent spamming OTP requests ─────────────────────
  const recentOtp = await OTPModel.findOne({ phone: cleanPhone })
    .sort({ createdAt: -1 })
    .lean();

  if (recentOtp) {
    const secondsSinceLast = (Date.now() - new Date(recentOtp.createdAt).getTime()) / 1000;
    if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast);
      throw new ApiError(429, `Please wait ${waitTime} seconds before requesting a new OTP`);
    }
  }

  // ── Clean up old OTPs for this phone ──────────────────────────────
  await OTPModel.deleteMany({ phone: cleanPhone });

  // ── Generate OTP (digits only) ────────────────────────────────────
  const otp = otpGenerator.generate(OTP_LENGTH, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  // ── Store in DB ───────────────────────────────────────────────────
  await OTPModel.create({
    phone: cleanPhone,
    otp,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    attempts: 0,
  });

  // ── Send via Twilio ───────────────────────────────────────────────
  try {
    const client = getTwilioClient();
    await client.messages.create({
      body: `Your FlashFits verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`,
      to: cleanPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
  } catch (error) {
    // Clean up the OTP record since SMS failed
    await OTPModel.deleteMany({ phone: cleanPhone });

    console.error('Twilio SMS error:', error.message, error.code);

    // Provide user-friendly messages for common Twilio errors
    if (error.code === 21211 || error.code === 21614) {
      throw new ApiError(400, "This phone number is invalid or cannot receive SMS");
    }
    if (error.code === 21608 || error.code === 21610) {
      throw new ApiError(400, "This phone number has been blocked or unsubscribed from SMS");
    }
    if (error.code === 20003) {
      throw new ApiError(500, "SMS service authentication failed. Please contact support.");
    }
    throw new ApiError(500, "Failed to send verification code. Please try again later.");
  }

  return res.status(200).json(
    new ApiResponse(200, { phone: cleanPhone }, "Verification code sent successfully")
  );
});

// ══════════════════════════════════════════════════════════════════════
//  VERIFY OTP
// ══════════════════════════════════════════════════════════════════════
const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, referralCode } = req.body;
  const cleanPhone = validatePhone(phone);

  if (!otp || typeof otp !== 'string') {
    throw new ApiError(400, "Verification code is required");
  }

  if (otp.length !== OTP_LENGTH) {
    throw new ApiError(400, `Verification code must be ${OTP_LENGTH} digits`);
  }

  // ── Find OTP record ───────────────────────────────────────────────
  const otpRecord = await OTPModel.findOne({ phone: cleanPhone });

  if (!otpRecord) {
    throw new ApiError(400, "No verification code found. Please request a new one.");
  }

  // ── Check expiry ──────────────────────────────────────────────────
  if (otpRecord.expiresAt < new Date()) {
    await OTPModel.deleteMany({ phone: cleanPhone });
    throw new ApiError(410, "Verification code has expired. Please request a new one.");
  }

  // ── Check brute-force attempts ────────────────────────────────────
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await OTPModel.deleteMany({ phone: cleanPhone });
    throw new ApiError(429, "Too many failed attempts. Please request a new verification code.");
  }

  // ── Check OTP match ───────────────────────────────────────────────
  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();

    const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
    if (remaining <= 0) {
      await OTPModel.deleteMany({ phone: cleanPhone });
      throw new ApiError(429, "Too many failed attempts. Please request a new verification code.");
    }

    throw new ApiError(400, `Invalid verification code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
  }

  // ── OTP is valid — find or create user ────────────────────────────
  let user = await User.findOne({ phoneNumber: cleanPhone });
  let isNewUser = false;
  let referrerId = null;

  if (!user) {
    // Check if referral code is valid
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        referrerId = referrer._id;
      }
    }

    user = await User.create({
      phoneNumber: cleanPhone,
      isVerified: true,
      referredBy: referrerId,
    });
    isNewUser = true;

    // Issue welcome coupon to new user if they used a referral code
    if (referrerId) {
      // Background issue coupon
      issueReferralCoupon(user._id, false).catch(err => console.error(err));
    }
  } else {
    // Update existing user
    user.isVerified = true;
    user.lastLogin = new Date();
    await user.save();
  }

  // ── Clean up OTP ──────────────────────────────────────────────────
  await OTPModel.deleteMany({ phone: cleanPhone });

  // ── Generate JWT (15 minutes for access, 30 days for refresh) ──────────
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
    }, "Authentication successful")
  );
});

export const refreshUserToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId || decoded.id); // depending on how it was signed

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    const token = jwt.sign(
      { userId: user._id, phoneNumber: user.phoneNumber, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json(
      new ApiResponse(200, { token, refreshToken: newRefreshToken }, "Token refreshed successfully")
    );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
});

// ══════════════════════════════════════════════════════════════════════
//  EMAIL REGISTRATION - SEND OTP
// ══════════════════════════════════════════════════════════════════════
export const registerSendOtp = asyncHandler(async (req, res) => {
  const { name, email, password, referralCode } = req.body;
  const cleanEmail = validateEmail(email);

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  // Check if an account already exists with this email and has a password
  const existingUser = await User.findOne({ email: cleanEmail });
  if (existingUser && existingUser.password && existingUser.isVerified) {
    throw new ApiError(400, "An account with this email already exists. Please sign in instead.");
  }

  // Rate limit: prevent spamming OTP requests (30-second cooldown)
  const recentOtp = await OTPModel.findOne({ email: cleanEmail, purpose: 'email_register' })
    .sort({ createdAt: -1 })
    .lean();

  if (recentOtp) {
    const secondsSinceLast = (Date.now() - new Date(recentOtp.createdAt).getTime()) / 1000;
    if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast);
      throw new ApiError(429, `Please wait ${waitTime} seconds before requesting a new code`);
    }
  }

  // Clean up existing OTPs for this email and purpose
  await OTPModel.deleteMany({ email: cleanEmail, purpose: 'email_register' });

  // Generate 6-digit OTP
  const otp = otpGenerator.generate(OTP_LENGTH, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  // Hash password before storing in temporary metadata
  const hashedPassword = await bcrypt.hash(password, 10);

  await OTPModel.create({
    email: cleanEmail,
    otp,
    purpose: 'email_register',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    attempts: 0,
    metadata: {
      name: name?.trim() || '',
      hashedPassword,
      referralCode: referralCode?.trim()?.toUpperCase() || null,
    },
  });

  try {
    await sendOtpEmail(cleanEmail, otp, 'email_register');
  } catch (error) {
    await OTPModel.deleteMany({ email: cleanEmail, purpose: 'email_register' });
    console.error("Email sending error:", error);
    throw new ApiError(500, "Failed to send verification email. Please check the email address or try again later.");
  }

  return res.status(200).json(
    new ApiResponse(200, { email: cleanEmail }, "Verification code sent to your email successfully")
  );
});

// ══════════════════════════════════════════════════════════════════════
//  EMAIL REGISTRATION - VERIFY OTP
// ══════════════════════════════════════════════════════════════════════
export const registerVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const cleanEmail = validateEmail(email);

  if (!otp || typeof otp !== 'string') {
    throw new ApiError(400, "Verification code is required");
  }

  if (otp.length !== OTP_LENGTH) {
    throw new ApiError(400, `Verification code must be ${OTP_LENGTH} digits`);
  }

  const otpRecord = await OTPModel.findOne({ email: cleanEmail, purpose: 'email_register' });

  if (!otpRecord) {
    throw new ApiError(400, "No verification code found. Please request a new one.");
  }

  if (otpRecord.expiresAt < new Date()) {
    await OTPModel.deleteMany({ email: cleanEmail, purpose: 'email_register' });
    throw new ApiError(410, "Verification code has expired. Please request a new one.");
  }

  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await OTPModel.deleteMany({ email: cleanEmail, purpose: 'email_register' });
    throw new ApiError(429, "Too many failed attempts. Please request a new verification code.");
  }

  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();

    const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
    if (remaining <= 0) {
      await OTPModel.deleteMany({ email: cleanEmail, purpose: 'email_register' });
      throw new ApiError(429, "Too many failed attempts. Please request a new verification code.");
    }

    throw new ApiError(400, `Invalid verification code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
  }

  // OTP is valid!
  const { name, hashedPassword, referralCode } = otpRecord.metadata || {};

  let user = await User.findOne({ email: cleanEmail });
  let isNewUser = false;
  let referrerId = null;

  if (referralCode) {
    const referrer = await User.findOne({ referralCode });
    if (referrer) {
      referrerId = referrer._id;
    }
  }

  if (!user) {
    user = await User.create({
      email: cleanEmail,
      name: name || '',
      password: hashedPassword,
      isVerified: true,
      referredBy: referrerId,
      lastLogin: new Date(),
    });
    isNewUser = true;

    if (referrerId) {
      issueReferralCoupon(user._id, false).catch(err => console.error(err));
    }
  } else {
    // Existing user updating credentials
    if (name && !user.name) user.name = name;
    if (hashedPassword) user.password = hashedPassword;
    user.isVerified = true;
    user.lastLogin = new Date();
    if (!user.referredBy && referrerId) {
      user.referredBy = referrerId;
      issueReferralCoupon(user._id, false).catch(err => console.error(err));
    }
    await user.save();
  }

  // Clean up used OTP
  await OTPModel.deleteMany({ email: cleanEmail, purpose: 'email_register' });

  // Generate tokens
  const token = jwt.sign(
    { userId: user._id, email: user.email, phoneNumber: user.phoneNumber },
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
      },
      isNewUser,
    }, "Registration successful")
  );
});

// ══════════════════════════════════════════════════════════════════════
//  EMAIL & PASSWORD LOGIN
// ══════════════════════════════════════════════════════════════════════
export const emailLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = validateEmail(email);

  if (!password || typeof password !== 'string') {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({ email: cleanEmail });
  if (!user) {
    throw new ApiError(400, "Invalid email or password");
  }

  if (!user.password) {
    throw new ApiError(400, "No password set for this account. If you created this account with Google or Apple, please sign in with that method.");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(400, "Invalid email or password");
  }

  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign(
    { userId: user._id, email: user.email, phoneNumber: user.phoneNumber },
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
      },
      isNewUser: false,
    }, "Login successful")
  );
});

// ══════════════════════════════════════════════════════════════════════
//  RESEND EMAIL OTP
// ══════════════════════════════════════════════════════════════════════
export const resendEmailOtp = asyncHandler(async (req, res) => {
  const { email, purpose = 'email_register' } = req.body;
  const cleanEmail = validateEmail(email);

  const existingOtp = await OTPModel.findOne({ email: cleanEmail, purpose })
    .sort({ createdAt: -1 });

  if (existingOtp) {
    const secondsSinceLast = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
    if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast);
      throw new ApiError(429, `Please wait ${waitTime} seconds before requesting a new code`);
    }
  }

  const otp = otpGenerator.generate(OTP_LENGTH, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  const metadata = existingOtp?.metadata || null;

  await OTPModel.deleteMany({ email: cleanEmail, purpose });

  await OTPModel.create({
    email: cleanEmail,
    otp,
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    metadata,
  });

  try {
    await sendOtpEmail(cleanEmail, otp, purpose);
  } catch (error) {
    await OTPModel.deleteMany({ email: cleanEmail, purpose });
    console.error("Email resend error:", error);
    throw new ApiError(500, "Failed to send verification email. Please try again later.");
  }

  return res.status(200).json(
    new ApiResponse(200, { email: cleanEmail }, "Verification code resent successfully")
  );
});

// ══════════════════════════════════════════════════════════════════════
//  FORGOT PASSWORD - SEND RESET OTP
// ══════════════════════════════════════════════════════════════════════
export const forgotPasswordSendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const cleanEmail = validateEmail(email);

  const user = await User.findOne({ email: cleanEmail });
  if (!user) {
    // Avoid leaking which emails exist
    return res.status(200).json(
      new ApiResponse(200, { email: cleanEmail }, "If an account exists with this email, a reset code has been sent.")
    );
  }

  const recentOtp = await OTPModel.findOne({ email: cleanEmail, purpose: 'password_reset' })
    .sort({ createdAt: -1 })
    .lean();

  if (recentOtp) {
    const secondsSinceLast = (Date.now() - new Date(recentOtp.createdAt).getTime()) / 1000;
    if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast);
      throw new ApiError(429, `Please wait ${waitTime} seconds before requesting a new code`);
    }
  }

  await OTPModel.deleteMany({ email: cleanEmail, purpose: 'password_reset' });

  const otp = otpGenerator.generate(OTP_LENGTH, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  await OTPModel.create({
    email: cleanEmail,
    otp,
    purpose: 'password_reset',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
  });

  try {
    await sendOtpEmail(cleanEmail, otp, 'password_reset');
  } catch (error) {
    await OTPModel.deleteMany({ email: cleanEmail, purpose: 'password_reset' });
    throw new ApiError(500, "Failed to send password reset email. Please try again later.");
  }

  return res.status(200).json(
    new ApiResponse(200, { email: cleanEmail }, "Password reset code sent to your email")
  );
});

// ══════════════════════════════════════════════════════════════════════
//  FORGOT PASSWORD - RESET WITH OTP
// ══════════════════════════════════════════════════════════════════════
export const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const cleanEmail = validateEmail(email);

  if (!otp || typeof otp !== 'string' || otp.length !== OTP_LENGTH) {
    throw new ApiError(400, `Verification code must be ${OTP_LENGTH} digits`);
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  const otpRecord = await OTPModel.findOne({ email: cleanEmail, purpose: 'password_reset' });
  if (!otpRecord) {
    throw new ApiError(400, "No password reset request found. Please request a new code.");
  }

  if (otpRecord.expiresAt < new Date()) {
    await OTPModel.deleteMany({ email: cleanEmail, purpose: 'password_reset' });
    throw new ApiError(410, "Password reset code has expired. Please request a new code.");
  }

  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await OTPModel.deleteMany({ email: cleanEmail, purpose: 'password_reset' });
    throw new ApiError(429, "Too many failed attempts. Please request a new code.");
  }

  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
    if (remaining <= 0) {
      await OTPModel.deleteMany({ email: cleanEmail, purpose: 'password_reset' });
      throw new ApiError(429, "Too many failed attempts. Please request a new code.");
    }
    throw new ApiError(400, `Invalid reset code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
  }

  const user = await User.findOne({ email: cleanEmail });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.isVerified = true;
  await user.save();

  await OTPModel.deleteMany({ email: cleanEmail, purpose: 'password_reset' });

  return res.status(200).json(
    new ApiResponse(200, null, "Password reset successfully. You can now log in.")
  );
});

export { sendOTP, verifyOTP };

