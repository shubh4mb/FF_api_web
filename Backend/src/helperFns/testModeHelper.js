

import AppConfig from "../models/appConfig.model.js";
import Merchant from "../models/merchant.model.js";
import mongoose from "mongoose";

/**
 * Returns true if the backend is running in testing mode.
 * Controlled strictly via process.env.TEST_MODE === 'true' (or ORDER_TEST_MODE === 'true')
 * in the local environment (.env), ensuring the live production server is never affected.
 */
export const isBackendInTestMode = async () => {
  if (process.env.TEST_MODE === 'true' || process.env.ORDER_TEST_MODE === 'true') {
    return true;
  }
  return false;
};

/**
 * Returns the designated test merchant (SB Fashion).
 */
export const getTestMerchant = async () => {
  try {
    let merchant = await Merchant.findOne({ shopName: /SB Fashion/i }).lean();
    if (!merchant) {
      merchant = await Merchant.findOne({ _id: new mongoose.Types.ObjectId("6a52c077f5d225d81a327965") }).lean();
    }
    return merchant;
  } catch (err) {
    console.error("[TestModeHelper] Error fetching test merchant:", err);
    return null;
  }
};

export const isTestMerchant = (merchantOrId) => {
  if (!merchantOrId) return false;
  const idStr = (merchantOrId._id || merchantOrId.id || merchantOrId).toString();
  if (idStr === "6a52c077f5d225d81a327965") return true;
  if (typeof merchantOrId === 'object' && merchantOrId.shopName && /SB Fashion/i.test(merchantOrId.shopName)) return true;
  return false;
};
