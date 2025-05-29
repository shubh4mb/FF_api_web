import Merchant from "../../models/merchant.model.js";

export const addMerchant = async (req, res) => {
    try {
      const merchant = new Merchant(req.body);
      await merchant.save();
      res.status(201).json({ message: "Merchant created", merchant });
    } catch (error) {
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