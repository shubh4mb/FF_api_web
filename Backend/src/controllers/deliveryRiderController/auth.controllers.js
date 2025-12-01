import DeliveryRider from "../../models/deliveryRider.model.js";
import jwt from "jsonwebtoken";
import { uploadToCloudinary } from "../../config/cloudinary.config.js";
import zoneModel from "../../models/zone.model.js";
// import { JWT_SECRET } from "../../config.js";

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, zoneId } = req.body;

    // 1. Validate zoneId format
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid zone ID format" 
      });
    }

    // 2. Check if zone actually exists
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(400).json({
        success: false,
        message: "Selected zone does not exist or is not available",
      });
    }

    // 3. Optional: Check if zone is active
    // if (!zone.isActive) { ... }

    // 4. Create rider with reference + denormalized name
    const deliveryRider = new DeliveryRider({
      name,
      email,
      phone,
      password, // hash it in real app!
      zone: zone._id,           // ← Only store ObjectId 
      zoneName: zone.zoneName || `${zone.city} Zone`, // ← Fast display
    });

    await deliveryRider.save();

    // 5. Populate zone if you want to return full info
    const populatedRider = await DeliveryRider.findById(deliveryRider._id)
      .populate("zone", "zoneName city state boundary");

    res.status(201).json({
      success: true,
      message: "Delivery rider registered successfully",
      rider: populatedRider,
    });
  } catch (error) {
    console.error("Rider registration error:", error);
    
    // Handle duplicate phone/email
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `This ${field} is already registered`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const verifyOTP = async (req, res) => {
  console.log("working");
  
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }
  
      // Check if rider already exists
      let deliveryRider = await DeliveryRider.findOne({ phone });
  
      if (!deliveryRider) {
        // Create a new rider if not exists
        deliveryRider = new DeliveryRider({
          phone,
          isAvailable: true, // default availability
          status: "active", // default status
        });
        
        await deliveryRider.save();
        const token = jwt.sign(
          { id: deliveryRider._id, phone: deliveryRider.phone },
          process.env.JWT_SECRET,
          { expiresIn: "60d" }
        );
        return res
          .status(201)
          .json({ message: "Delivery rider created successfully", deliveryRider, token });
      }
      const token = jwt.sign(
        { id: deliveryRider._id, phone: deliveryRider.phone },
        process.env.JWT_SECRET,
        { expiresIn: "60d" }
      );
      res.status(200).json({ message: "Delivery rider login successfully", deliveryRider, token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

export const logout = async (req, res) => {
    try {
      res.clearCookie("token");
      res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

export const savePersonalDetails = async (req, res) => {
    try {
      const { fullName, dob, age, gender, email, city, area, pincode, phone , zoneId,zoneName } = req.body;
      console.log(req.body);
      
      const riderId = req.riderId;
      const zoneDoc = await zoneModel.findById(zone);
  
      console.log("📦 Received body:", req.body);
  
      if (!riderId) {
        return res.status(400).json({ message: "Rider ID missing (authentication issue)" });
      }
  
      // ✅ Find existing rider
      let rider = await DeliveryRider.findById(riderId);

  
      if (!rider) {
        // ❗ Rider not found, create new
        rider = new DeliveryRider({
          fullName,
          dob,
          age,
          gender,
          email,
          city,
          area, 
          pincode,
          phone,
          zoneId:zoneId,
          zoneName:zoneName
        });
      } else {
        // ✅ Update existing details
        rider.fullName = fullName || rider.fullName;
        rider.dob = dob || rider.dob;
        rider.age = age || rider.age;
        rider.gender = gender || rider.gender;
        rider.email = email || rider.email;
        rider.city = city || rider.city;
        rider.area = area || rider.area;
        rider.pincode = pincode || rider.pincode;
        rider.phone = phone || rider.phone; 
      }
  
      await rider.save();
  
      res.status(200).json({
        success: true,
        message: "✅ Personal details saved successfully.",
        data: rider,
      });
    } catch (error) {
      console.error("❌ Error saving personal details:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };

export const uploadDocuments = async (req, res) => {
    try {
      // const { phone } = req.body; // rider identifier (should be passed from frontend)
      const riderId = req.riderId;
      // if (!phone) {
      //   return res.status(400).json({ success: false, message: "Phone number required" });
      // }
  
      const rider = await DeliveryRider.findOne({ _id: riderId });
      if (!rider) {
        return res.status(404).json({ success: false, message: "Rider not found" });
      }
  
      const uploadedFiles = {};
  
      // Upload all received files to Cloudinary
     // Upload documents dynamically
for (const [fieldName, fileArray] of Object.entries(req.files)) {
  const file = fileArray[0];
  try {
    const result = await uploadToCloudinary(file.buffer, {
      folder: `riders/${riderId}/documents`,
      resource_type: "auto",
    });

    uploadedFiles[fieldName] = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  } catch (err) {
    console.error(`Error uploading ${fieldName}:`, err.message);
    return res.status(500).json({
      success: false,
      message: `Failed to upload ${fieldName}`,
      error: err.message,
    });
  }
}

// Save Cloudinary URLs in MongoDB
rider.documents = {
  ...rider.documents,
  aadhaarFront: uploadedFiles.aadhaarFront || { public_id: "", url: "" },
  aadhaarBack: uploadedFiles.aadhaarBack || { public_id: "", url: "" },
  licenseFront: uploadedFiles.licenseFront || { public_id: "", url: "" },
  licenseBack: uploadedFiles.licenseBack || { public_id: "", url: "" },
  panFront: uploadedFiles.panFront || { public_id: "", url: "" },
  panBack: uploadedFiles.panBack || { public_id: "", url: "" },
};

  
      await rider.save();
  
      res.status(200).json({
        success: true,
        message: "Documents uploaded and saved successfully",
        documents: rider.documents,
      });
    } catch (error) {
      console.error("Error in uploadDocuments:", error.message);
      res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
  };

export const saveBankDetails = async (req, res) => {
    try {
      const { accountHolderName, bankName, accountNumber, ifsc } = req.body;
  
      // Basic validation
      if (!accountHolderName || !bankName || !accountNumber || !ifsc) {
        return res.status(400).json({ message: "All fields are required" });
      }
  
      // Example: simulate DB save
      console.log("✅ Bank details received:", {
        accountHolderName,
        bankName,
        accountNumber,
        ifsc,
      });
  
      // You can later replace this with MongoDB save logic like:
      const rider = await DeliveryRider.findByIdAndUpdate(req.riderId, {
        bankDetails: { accountHolderName, bankName, accountNumber, ifsc },
      }, { new: true });

      if (!rider) {
        return res.status(404).json({ message: "Rider not found" });
      }
      rider.bankDetails = {
        accountHolderName,
        bankName,
        accountNumber,
        ifsc,
      };
      await rider.save();
  
      return res.status(200).json({
        success: true,
        message: "Bank details saved successfully",
      });
    } catch (error) {
      console.error("❌ Error saving bank details:", error);
      return res.status(500).json({ message: "Server error while saving bank details" });
    }
  };  

  export const getRider = async(req,res)=>{
    console.log("working");
    
    try {
      console.log(req.riderId);
      
      const rider = await DeliveryRider.findById(req.riderId);
      if (!rider) {
        return res.status(404).json({ message: "Rider not found" });
      }
      res.status(200).json({ rider });
    } catch (error) {
      console.error("❌ Error fetching rider:", error);
      res.status(500).json({ message: "Server error while fetching rider" });
    }
  }
  