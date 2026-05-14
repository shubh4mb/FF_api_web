import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Merchant from "../../models/merchant.model.js";
import Brand from "../../models/brand.model.js";
import { sendMail } from '../../services/mail.service.js';
import Zone from "../../models/zone.model.js";
import Hub from "../../models/hub.model.js";
import dotenv from 'dotenv';
dotenv.config();
import { storageService } from '../../services/storage.service.js';
const jwt_secret = "hehe"
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendEmailOtp = async (req, res) => {
  console.log(req.body);
  try {
    const { email, password, phoneNumber } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    const otp = generateOtp();
    const expiry = Date.now() + 5 * 60 * 1000;

    let merchant = await Merchant.findOne({ email });
    if (!merchant) {
      merchant = new Merchant({ email, isActive: false });
    }

    // Store hashed password if provided during initial signup
    if (password) {
      merchant.password = await bcrypt.hash(password, 10);
    }

    // Store phone number if provided during initial signup  
    if (phoneNumber) {
      merchant.phoneNumber = phoneNumber;
    }

    merchant.emailOtp = otp;
    merchant.emailOtpExpiry = expiry;
    await merchant.save();

    await sendMail(
      email,
      "Your OTP Code",
      `Your FlashFits OTP is ${otp}. It expires in 5 minutes.`
    );

    res.status(200).json({ otp, message: "OTP sent successfully" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ message: "Failed to send OTP", error: err.message });
  }
};


export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP required' });
    }

    const merchant = await Merchant.findOne({ email });
    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found..........' });
    }

    if (merchant.emailOtp !== otp || Date.now() > merchant.emailOtpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP valid → clear OTP, create/activate merchant record
    merchant.emailOtp = undefined;
    merchant.emailOtpExpiry = undefined;
    await merchant.save();

    const token = jwt.sign(
      { id: merchant._id, email: merchant.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" } 
    );

    const refreshToken = jwt.sign(
      { id: merchant._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: "Email verified successfully",
      merchant: {
        _id: merchant._id,
        email: merchant.email,
        zoneId: merchant.zoneId
      },
      token, // ✅ send token to frontend
    });
  } catch (error) {
    console.error('OTP verification failed:', error);
    res.status(500).json({ message: 'OTP verification failed' });
  }
};


export const registerPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: "Phone number is required" });

    const existingMerchant = await Merchant.findOne({ phoneNumber });
    if (existingMerchant) {
      return res.status(400).json({ message: "Phone number already registered" });
    }

    const merchant = new Merchant({
      phoneNumber,
      email: false // 👈 force undefined 
    });

    await merchant.save();

    res.status(201).json({
      message: "Phone number registered successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error saving phone:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const toggleMerchantOnlineStatus = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { isOnline } = req.body;

    const merchant = await Merchant.findById(merchantId);

    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    // Safety check: Only merchants in a Try & Buy zone can toggle online status
    if (!merchant.zoneId) {
      return res.status(403).json({
        success: false,
        message: "Online toggle is only available for merchants in Try & Buy zones."
      });
    }

    merchant.isOnline = !!isOnline;
    await merchant.save();

    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    res.status(200).json({
      success: true,
      message: `Merchant is now ${merchant.isOnline ? 'online' : 'offline'}`,
      isOnline: merchant.isOnline
    });
  } catch (error) {
    console.error("Toggle online status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMerchantByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    console.log(email, 'email');

    const merchant = await Merchant.findOne({ email });
    if (!merchant) return res.status(404).json({ success: false, message: 'Merchant not found11------' });

    res.json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMerchantShopDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;
    let { shopName, shopDescription, businessType, category, genderCategory, ownerName, managerName, managerPhoneNumber, managerEmail, latitude, longitude } = req.body;

    // Sanitize genderCategory: handle array or comma-separated string
    if (genderCategory) {
      if (typeof genderCategory === 'string') {
        genderCategory = genderCategory.split(',').map(item => item.trim());
      } else if (!Array.isArray(genderCategory)) {
        genderCategory = [genderCategory];
      }
    }

    // Sanitize category: handle array or comma-separated string
    if (category) {
      if (typeof category === 'string') {
        category = category.split(',').map(item => item.trim());
      } else if (!Array.isArray(category)) {
        category = [category];
      }
    }

    // Parse address (string or form-data)
    let addressObj = {};
    if (req.body.address) {
      try {
        addressObj = JSON.parse(req.body.address);
      } catch {
        addressObj = {
          street: req.body["address[street]"] || "",
          city: req.body["address[city]"] || "",
          state: req.body["address[state]"] || "",
          postalCode: req.body["address[postalCode]"] || "",
          landmark: req.body["address[landmark]"] || "",
          note: req.body["address[note]"] || "",
        };
      }
    }

    // Extract coordinates
    const lat = latitude || addressObj.latitude || req.body["address[latitude]"];
    const lng = longitude || addressObj.longitude || req.body["address[longitude]"];

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Location (latitude & longitude) is required to update shop details.",
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude values.",
      });
    }

    // Build final address with GeoJSON Point
    const finalAddress = {
      ...addressObj,
      latitude: latNum,
      longitude: lngNum,
      location: {
        type: "Point",
        coordinates: [lngNum, latNum], // [longitude, latitude] — MongoDB standard
      },
    };

    let enableCourierDelivery = req.body.enableCourierDelivery === 'true' || req.body.enableCourierDelivery === true;
    let shipsWithinHours = req.body.shipsWithinHours ? Number(req.body.shipsWithinHours) : undefined;
    let acceptsReturns = req.body.acceptsReturns === 'true' || req.body.acceptsReturns === true;


    // CRITICAL FIRST CHECK: Check if this point falls inside ANY zone's boundary (Try & Buy Zone)
    const zone = await Zone.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: [lngNum, latNum],
          },
        },
      },
    });

    let zoneName = null;
    let zoneId = null;

    if (zone) {
      // Inside Try & Buy Zone
      zoneName = zone.zoneName;
      zoneId = zone._id;

      // If they optionally chose courier delivery, ensure they provided the required conditions
      if (enableCourierDelivery && (!shipsWithinHours || !acceptsReturns)) {
        return res.status(400).json({
          success: false,
          message: "To enable Courier Delivery, you must specify shipping hours and accept returns."
        });
      }
    } else {
      // Outside Try & Buy Zone: Try to find a hub, but allow even if not found
      const postalCode = addressObj.postalCode || req.body["address[postalCode]"];
      const hub = await Hub.findOne({ "serviceablePincodes.code": postalCode });

      if (hub) {
        zoneName = "Courier Only - " + hub.name;
      } else {
        zoneName = "Courier Only (Pan India)";
      }

      enableCourierDelivery = true; // Force ON for merchants outside Try & Buy zones

      // Enforce mandatory requirements for out-of-zone
      if (!shipsWithinHours || !acceptsReturns) {
        return res.status(400).json({
          success: false,
          requiresOutOfZoneDetails: true,
          message: "Merchants outside Try & Buy zones must support courier shipping, specify max shipping hours, and accept returns."
        });
      }
    }

    let logo;
    if (req.files && req.files['logo']) {
      logo = await storageService.uploadSingle(req.files['logo'], "merchant_logos");
    }

    let backgroundImage;
    if (req.files && req.files['backgroundImage']) {
      backgroundImage = await storageService.uploadSingle(req.files['backgroundImage'], "merchant_backgrounds");
    }

    // Now safe to update
    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $set: {
          shopName,
          shopDescription,
          businessType,
          category,
          genderCategory,
          ownerName,
          managerName,
          managerPhoneNumber,
          managerEmail,
          address: finalAddress,
          zoneName,
          zoneId,
          enableCourierDelivery,
          shipsWithinHours,
          acceptsReturns,
          ...(logo && { logo }),
          ...(backgroundImage && { backgroundImage }),
        },
      },
      { new: true, runValidators: true }
    );

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    return res.json({
      success: true,
      message: "Shop details updated successfully",
      merchant,
      zone: zoneName
    });
  } catch (error) {
    console.error("Error updating merchant shop details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updateMerchantBankDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      { $set: { bankDetails: req.body } },
      { new: true }
    );
    res.json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMerchantOperatingHours = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      { $set: { operatingHours: req.body } },
      { new: true }
    );
    res.json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      { $set: { status: 'pending_verification' } },
      { new: true }
    );
    res.json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginMerchant = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/Phone and password are required" });
    }

    // Identify dynamically if the identifier is an email or phone number
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const query = isEmail ? { email: identifier } : { phoneNumber: identifier };

    const merchant = await Merchant.findOne(query);

    if (!merchant) {
      return res.status(400).json({ message: "Merchant not found" });
    }

    if (!merchant.password) {
      return res.status(400).json({ message: "Invalid credentials or account not fully registered" });
    }

    const isMatch = await bcrypt.compare(password, merchant.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: merchant._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: merchant._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });

    // ==== Response ====
    return res.json({
      token,
      merchant: {
        id: merchant._id,
        shopName: merchant.shopName,
        email: merchant.email,
        phoneNumber: merchant.phoneNumber,
        isActive: merchant.isActive,
        status: merchant.status,
        zoneId: merchant.zoneId
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const registerMerchant = async (req, res) => {
  try {
    const { identifier, password, shopName } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Identifier (Email/Phone) and password are required" });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const query = isEmail ? { email: identifier } : { phoneNumber: identifier };

    let merchant = await Merchant.findOne(query);

    const hashedPassword = await bcrypt.hash(password, 10);

    if (merchant) {
      if (merchant.isActive) {
        return res.status(400).json({ message: "Merchant already active and registered with this identifier" });
      }
      // Update existing pre-verified user
      merchant.password = hashedPassword;
      merchant.shopName = shopName || merchant.shopName || "New Shop";
    } else {
      const newMerchantData = {
        password: hashedPassword,
        shopName: shopName || "New Shop",
        isActive: false,
      };

      if (isEmail) {
        newMerchantData.email = identifier;
      } else {
        newMerchantData.phoneNumber = identifier;
      }

      merchant = new Merchant(newMerchantData);
    }

    await merchant.save();

    res.status(201).json({
      message: "Merchant registered successfully",
      merchant: {
        id: merchant._id,
        shopName: merchant.shopName,
        email: merchant.email,
        phoneNumber: merchant.phoneNumber,
        isActive: merchant.isActive,
        status: merchant.status,
        zoneId: merchant.zoneId,
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMerchantKYC = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { panNumber, gstNumber, businessProofType } = req.body;
    const merchant = await Merchant.findById(merchantId);

    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // Initialize nested structures if they don't exist
    if (!merchant.kyc) merchant.kyc = {};
    if (!merchant.kyc.pan) merchant.kyc.pan = { verified: false };
    if (!merchant.kyc.gst) merchant.kyc.gst = { verified: false };
    if (!merchant.kyc.businessProof) merchant.kyc.businessProof = { verified: false };
    if (!merchant.kyc.bankProof) merchant.kyc.bankProof = { verified: false };

    if (panNumber) merchant.kyc.pan.number = panNumber;
    if (gstNumber) merchant.kyc.gst.number = gstNumber;
    if (businessProofType) merchant.kyc.businessProof.proofType = businessProofType;

    if (req.files) {
      if (req.files.panImage) {
        merchant.kyc.pan.image = await storageService.uploadSingle(req.files.panImage[0], `merchant/${merchantId}/kyc/pan`);
      }
      if (req.files.gstImage) {
        merchant.kyc.gst.image = await storageService.uploadSingle(req.files.gstImage[0], `merchant/${merchantId}/kyc/gst`);
      }
      if (req.files.businessProofImage) {
        merchant.kyc.businessProof.image = await storageService.uploadSingle(req.files.businessProofImage[0], `merchant/${merchantId}/kyc/business`);
      }
      if (req.files.bankProofImage) {
        merchant.kyc.bankProof.image = await storageService.uploadSingle(req.files.bankProofImage[0], `merchant/${merchantId}/kyc/bank`);
      }
    }

    await merchant.save();
    res.status(200).json({ success: true, message: "KYC documents updated successfully", merchant });
  } catch (error) {
    console.error("KYC update error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const refreshMerchantToken = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token is required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const merchant = await Merchant.findById(decoded.id);

    if (!merchant) {
      return res.status(401).json({ message: "Merchant not found" });
    }

    const token = jwt.sign(
      { id: merchant._id, email: merchant.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    const newRefreshToken = jwt.sign(
      { id: merchant._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ 
      token, 
      merchant: {
        id: merchant._id,
        shopName: merchant.shopName,
        email: merchant.email,
        phoneNumber: merchant.phoneNumber,
        isActive: merchant.isActive,
        status: merchant.status,
        zoneId: merchant.zoneId
      },
      message: "Merchant token refreshed successfully" 
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired merchant refresh token" });
  }
};

export const logoutMerchant = async (req, res) => {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
