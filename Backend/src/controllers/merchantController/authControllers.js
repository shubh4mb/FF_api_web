import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Merchant from "../../models/merchant.model.js";
import Brand from "../../models/brand.model.js";
const jwt_secret="hehe"


// REGISTER MERCHANT
export const registerMerchant = async (req, res) => {
  try {
    const { shopName, ownerName, email, phoneNumber, password, category } = req.body;

    // Check if merchant already exists
    const existingMerchant = await Merchant.findOne({ email });
    if (existingMerchant) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create merchant with dummy data for missing fields
    const merchant = new Merchant({
      shopName,
      shopDescription: "Default shop description",
      ownerName,
      email,
      phoneNumber,
      password: hashedPassword,
      logo: {
        public_id: "default_logo_id",
        url: "https://via.placeholder.com/150"
      },
      category,
      address: {
        street: "123 Test Street",
        city: "Test City",
        state: "Test State",
        postalCode: "000000",
        country: "Test Country"
      },
      documents: {
        gstNumber: "GST123456",
        gstCertificateUrl: "https://via.placeholder.com/200",
        shopLogoUrl: "https://via.placeholder.com/150"
      },
      bankDetails: {
        accountHolderName: "Default Holder",
        accountNumber: "1234567890",
        ifscCode: "TEST0001",
        bankName: "Test Bank",
        upiId: "default@upi",
        isBankVerified: false
      },
      kyc: {
        gstNumber: "GST123456",
        gstCertificateUrl: "https://via.placeholder.com/200",
        panNumber: "PAN123456",
        panCardUrl: "https://via.placeholder.com/200",
        businessLicenseUrl: "https://via.placeholder.com/200",
        isKycVerified: false
      },
      operatingHours: {
        open: "09:00 AM",
        close: "09:00 PM",
        daysOpen: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      }
    });

    await merchant.save();

    res.status(201).json({
      message: "Merchant registered successfully",
      merchant
    });

  } catch (error) {
    console.error("Error registering merchant:", error);
    res.status(500).json({ message: error.message });
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
      return res.status(400).json({ message: "Merchant not found" });
    }

    const isMatch = await bcrypt.compare(password, merchant.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: merchant._id },
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




