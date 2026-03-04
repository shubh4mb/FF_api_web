// src/controllers/authController.js
import twilio from 'twilio';
import otpGenerator from 'otp-generator';
import User from '../models/user.model.js';
import OTPModel from '../models/otp.model.js'; // Store OTP records temporarily
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
// Twilio client setup
const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Send OTP to user phone number
const sendOTP = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(400, "Phone number is required");
  }

  let user = await User.findOne({ phoneNumber });
  if (user) {
    throw new ApiError(400, "User already exists");
  }

  // Generate OTP (6 digits)
  const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });

  // Save OTP in the database with an expiration time
  const otpRecord = new OTPModel({
    phoneNumber,
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // OTP expires in 5 minutes
  });
  await otpRecord.save();

  try {
    // Send OTP via Twilio SMS
    await client.messages.create({
      body: `Your OTP is: ${otp}`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
    });
    return res.status(200).json(new ApiResponse(200, {}, "OTP sent successfully"));
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new ApiError(500, "Failed to send OTP", [error.message]);
  }
});

// Verify OTP and authenticate user
const verifyOTP = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    throw new ApiError(400, "Phone number and OTP are required");
  }

  // Find the OTP record for the user
  const otpRecord = await OTPModel.findOne({ phoneNumber });

  if (!otpRecord) {
    throw new ApiError(400, "OTP not sent or expired");
  }

  // Check if OTP is valid and not expired
  if (otpRecord.otp !== otp) {
    throw new ApiError(400, "Invalid OTP");
  }
  if (otpRecord.expiresAt < Date.now()) {
    throw new ApiError(400, "OTP has expired");
  }

  // OTP is valid, check if user exists
  let user = await User.findOne({ phoneNumber });
  if (!user) {
    // If user doesn't exist, create a new user
    user = new User({ phoneNumber });
    await user.save();
  }

  // Generate JWT token
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Send token to the client
  return res.status(200).json(new ApiResponse(200, { token }, "Authentication successful"));
});

export { sendOTP, verifyOTP };
