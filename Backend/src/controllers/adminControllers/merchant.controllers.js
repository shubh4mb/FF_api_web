import Merchant from "../../models/merchant.model.js";
import { uploadToCloudinary } from "../../config/cloudinary.config.js";

export const addMerchant = async (req, res) => {
    try {
      console.log("hiii");
      const merchant = new Merchant(req.body);
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Logo is required'
        });
      }
      
      let imageDetails = null; // ✅ Declare outside try block
      try {
        const imageResult = await uploadToCloudinary(req.file.buffer, {
          folder: 'merchant/logo',
          resource_type: 'auto'
        });
    
        imageDetails = {
          public_id: imageResult.public_id,
          url: imageResult.secure_url
        };
      } catch (uploadError) {
        console.log(uploadError);
        
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to Cloudinary',
          error: uploadError.message
        });
      }
      merchant.logo = imageDetails;
      await merchant.save();
      res.status(201).json({ message: "Merchant created", merchant });
    } catch (error) {
      console.log(error);
      
      res.status(400).json({ message: error.message });
    }
  };

  export const getMerchants = async (req, res) => {
    try {
      const merchants = await Merchant.find({isActive:true});
      res.status(200).json({ merchants });
    } catch (error) {
      res.status(500).json({ message: "❌ " + error.message });
    }
  };

  export const getMerchantById = async (req, res) => {
    try {
      const merchant = await Merchant.findById(req.params.id);
      res.status(200).json({ merchant });
    } catch (error) {
      res.status(500).json({ message: "❌ " + error.message });
    }
  };

  export const updateMerchantById = async (req, res) => {
    let imageDetails = null; // ✅ Declare outside try block
    try {

      if(req.file){
        try {
          const imageResult = await uploadToCloudinary(req.file.buffer, {
            folder: 'merchant/logo',
            resource_type: 'auto'
          });
      
          imageDetails = {
            public_id: imageResult.public_id,
            url: imageResult.secure_url
          };
        } catch (uploadError) {
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to Cloudinary',
            error: uploadError.message
          });
        }
        req.body.logo = imageDetails;
      }
      const merchant = await Merchant.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.status(200).json({ merchant });
    } catch (error) {
      res.status(500).json({ message: "❌ " + error.message });
    }
  };