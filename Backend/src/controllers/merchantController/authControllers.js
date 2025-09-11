import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Merchant from "../../models/merchant.model.js";
import Brand from "../../models/brand.model.js";
import nodemailer from 'nodemailer'; 
// import dotenv from 'dotenv';
// dotenv.config();
import { uploadToCloudinary } from '../../config/cloudinary.config.js';
const jwt_secret="hehe"
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   // your gmail address
    pass: process.env.EMAIL_PASS,   // the app password
  },
});
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const otp = generateOtp();
    const expiry = Date.now() + 5 * 60 * 1000;

    let merchant = await Merchant.findOne({ email });
    if (!merchant) {
      merchant = new Merchant({ email, isActive: false });
    }

    merchant.emailOtp = otp;
    merchant.emailOtpExpiry = expiry;
    await merchant.save();

    await transporter.sendMail({
      from: `"FlashFits" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    });

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ message: "Failed to send OTP" });
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

    const { shopName, shopDescription, category, ownerName } = req.body;

    // Address handling (could come as JSON string)
    let addressObj;
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

    // Upload logo if file exists
    let logo;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "merchant_logos",
        resource_type: "image",
      });

      logo = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    // Update merchant
    const merchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $set: {
          shopName,
          shopDescription,
          category,
          ownerName,
          ...(logo && { logo }),
          ...(addressObj && { address: addressObj }),
        },
      },
      { new: true }
    );

    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found2" });
    }

    res.json({ success: true, merchant });
  } catch (error) {
    console.error("Error updating shop details:", error);
    res.status(500).json({ success: false, message: error.message });
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
  // console.log(req.body,'req.body;req.body;req.body;');
  
  try {
    const { identifier, email, password } = req.body;
    const loginId = identifier || email;

    if (!loginId || !password) {
      return res.status(400).json({ message: "Email/Phone and password are required" });
    }

    const merchant = await Merchant.findOne({
      $or: [
        { email: loginId },
        { phoneNumber: loginId }
      ]
    });

    if (!merchant) {
      return res.status(400).json({ message: "Merchant not found3" });
    }

    const isMatch = await bcrypt.compare(password, merchant.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { merchantId: merchant._id },
      jwt_secret,
      { expiresIn: "7d" }
    );

    // === NEW CODE HERE: Find the brand for this merchant ===
    const brand = await Brand.findOne({
      createdById: merchant._id,
      createdByType: 'Merchant',
    });

    // console.log(brand,'BrandBrandBrandBrandBrand');
    

    // If the merchant has a brand, use its name, else null or empty string
    const brandName = brand ? brand.name : null;

    // ==== Response ====
    return res.json({
      token,
      merchant: {
        id: merchant._id,
        shopName: merchant.shopName,
        email: merchant.email,
        phoneNumber: merchant.phoneNumber,
        brandName,        // <-- Add brand name here
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};




