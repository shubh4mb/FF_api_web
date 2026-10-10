import Merchant from "../../models/merchant.model.js";
import { isBackendInTestMode, isTestMerchant } from "../../helperFns/testModeHelper.js";

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
    console.log(merchantId, 'from controller');
    
    if (!merchantId) {
      return res.status(400).json({ message: "Merchant ID is missing" });
    }

    let merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    const inTestMode = await isBackendInTestMode();
    if (inTestMode && isTestMerchant(merchant)) {
      const merchantObj = merchant.toObject ? merchant.toObject() : { ...merchant };
      merchantObj.status = 'active';
      merchantObj.isActive = true;
      merchantObj.isStoreActive = true;
      merchantObj.isOnline = true;
      merchantObj.rejectionReason = "";
      return res.status(200).json({ merchant: merchantObj });
    }

    return res.status(200).json({ merchant });
  } catch (error) {
    console.error("Get Merchant Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
  

  