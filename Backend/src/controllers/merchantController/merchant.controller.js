import Merchant from "../../models/merchant.model.js";

export const addMerchant = async (req, res) => {
    console.log("ih");
    
    try {
      const merchant = new Merchant(req.body);
      await merchant.save();
      res.status(201).json({ message: "Merchant created", merchant });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  };

  export const getMerchantById = async (req, res) => {
    try {
      const merchantId = req.merchantId; // assuming middleware sets this
      console.log(merchantId,'from controller');
      
      if (!merchantId) {
        return res.status(400).json({ message: "Merchant ID is missing" });
      }
  
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
  
      return res.status(200).json({ merchant });
    } catch (error) {
      console.error("Get Merchant Error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  

  