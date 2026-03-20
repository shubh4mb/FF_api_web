import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Merchant from "../../models/merchant.model.js";
import Brand from "../../models/brand.model.js";
import nodemailer from 'nodemailer';
import Zone from "../../models/zone.model.js";
import dotenv from 'dotenv';
dotenv.config();
import { uploadToCloudinary } from '../../config/cloudinary.config.js';
const jwt_secret = "hehe"
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   // your gmail address
    pass: process.env.EMAIL_PASS,   // the app password
  },
});
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

    await transporter.sendMail({
      from: `"FlashFits" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your FlashFits OTP is ${otp}. It expires in 5 minutes.`,
    });

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
      { expiresIn: "7d" } // token expiry
    );

    res.status(200).json({
      message: "Email verified successfully",
      merchant: { _id: merchant._id, email: merchant.email },
      token, // ✅ send token to frontend
    });
  } catch (error) {
    console.error('OTP verification failed:', error);
    res.status(500).json({ message: 'OTP verification failed' });
  }
};


// export const registerEmail = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ message: "Email is required" });

//     const existingMerchant = await Merchant.findOne({ email });
//     if (existingMerchant) {
//       return res.status(400).json({ message: "Email already registered" });
//     }

//     const merchant = new Merchant({ 
//       email, 
//       phoneNumber: false // 👈 force undefined
//     });

//     await merchant.save();

//     res.status(201).json({
//       message: "Email registered successfully",
//       merchant,
//     });
//   } catch (error) {
//     console.error("Error saving email:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };


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

// Update Bank Details// Update Operating Hours// Activate Merchant
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
    let { shopName, shopDescription, category, genderCategory, ownerName, latitude, longitude } = req.body;

    // Sanitize genderCategory: handle array or comma-separated string
    if (genderCategory) {
      if (typeof genderCategory === 'string') {
        genderCategory = genderCategory.split(',').map(item => item.trim());
      } else if (!Array.isArray(genderCategory)) {
        genderCategory = [genderCategory];
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
          postalCode: req.body["address[postalCode]"] || "",
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

    // CRITICAL: Check if this point falls inside ANY zone's boundary
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

    if (!zone) {
      return res.status(400).json({
        success: false,
        message: "Your shop location is outside our serviceable zones. We currently do not onboard merchants from this area.",
        // Optional: include hint for admin
        debug: { lat: latNum, lng: lngNum },
      });
    }

    let logo;
    if (req.files && req.files['logo']) {
      const result = await uploadToCloudinary(req.files['logo'][0].buffer, {
        folder: "merchant_logos",
        resource_type: "image",
      });
      logo = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    let backgroundImage;
    if (req.files && req.files['backgroundImage']) {
      const result = await uploadToCloudinary(req.files['backgroundImage'][0].buffer, {
        folder: "merchant_backgrounds",
        resource_type: "image",
      });
      backgroundImage = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    // Now safe to update
    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $set: {
          shopName,
          shopDescription,
          category,
          genderCategory,
          ownerName,
          address: finalAddress,
          zoneName: zone.zoneName,
          zoneId: zone._id,
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
      zone: zone.zoneName
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
      { $set: { isActive: true } },
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
      { expiresIn: "7d" }
    );

    // ==== Response ====
    return res.json({
      token,
      merchant: {
        id: merchant._id,
        shopName: merchant.shopName,
        email: merchant.email,
        phoneNumber: merchant.phoneNumber,
        isActive: merchant.isActive
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
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
};




