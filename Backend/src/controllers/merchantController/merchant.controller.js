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