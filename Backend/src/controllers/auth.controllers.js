// src/controllers/auth.controllers.js
import twilio from 'twilio';
import otpGenerator from 'otp-generator';
import User from '../models/user.model.js';
import OTPModel from '../models/otp.model.js';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

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
  const { phone, otp } = req.body;
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

  if (!user) {
    user = await User.create({
      phoneNumber: cleanPhone,
      isVerified: true,
    });
    isNewUser = true;
  } else {
    // Update existing user
    user.isVerified = true;
    user.lastLogin = new Date();
    await user.save();
  }

  // ── Clean up OTP ──────────────────────────────────────────────────
  await OTPModel.deleteMany({ phone: cleanPhone });

  // ── Generate JWT (30 days — matches existing phoneLogin) ──────────
  const token = jwt.sign(
    { userId: user._id, phoneNumber: user.phoneNumber },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  return res.status(200).json(
    new ApiResponse(200, {
      token,
      userId: user._id,
      isNewUser,
    }, "Authentication successful")
  );
});

export { sendOTP, verifyOTP };
