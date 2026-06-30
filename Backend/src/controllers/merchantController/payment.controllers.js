import razorpayInstance from "../../config/RazorPay.js";
import crypto from "crypto";
import Merchant from "../../models/merchant.model.js";
import AppConfig from "../../models/appConfig.model.js";
import mongoose from "mongoose";
import { logAuditEvent } from "../../utils/auditLogger.js";

// Create Razorpay order for registration fee
export const createRegistrationFeeOrder = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({ success: false, message: "Invalid Merchant ID format" });
    }

    const merchant = await Merchant.findById(merchantId);

    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    // Allow payment if status is pending_payment OR pending_verification
    const allowedStatuses = ['pending_payment', 'pending_verification'];
    if (!allowedStatuses.includes(merchant.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Current status is '${merchant.status}'. Payment is only allowed for pending accounts.` 
      });
    }

    const config = await AppConfig.getConfig();
    const feeAmount = config.merchantRegistrationFee;

    if (feeAmount <= 0) {
        merchant.isRegistrationFeePaid = true;
        merchant.status = 'active';
        merchant.isActive = true;
        await merchant.save();
        return res.json({ success: true, message: "Fee is 0, auto-activated.", status: 'active' });
    }

    const options = {
      amount: feeAmount * 100,
      currency: "INR",
      receipt: `r_${merchantId.toString().slice(-8)}_${Date.now()}`
    };

    const order = await razorpayInstance.orders.create(options);
    
    // Save order ID to merchant for webhook tracking
    merchant.razorpayOrderId = order.id;
    await merchant.save();
    
    await logAuditEvent({
      action: "MERCHANT_REGISTRATION_PAYMENT_INITIATED",
      message: `Registration fee payment of ₹${feeAmount} initiated for merchant: ${merchant.shopName}`,
      status: "pending",
      merchantId: merchant._id,
      details: { razorpayOrderId: order.id, amount: feeAmount },
      req,
    });
    
    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Error creating registration fee order:", error);
    res.status(500).json({ success: false, message: error?.error?.description || error.message });
  }
};

// Verify payment and update merchant status
export const verifyRegistrationFeePayment = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment is successful
      const merchant = await Merchant.findById(merchantId);
      if (!merchant) {
        return res.status(404).json({ success: false, message: "Merchant not found" });
      }

      merchant.isRegistrationFeePaid = true;
      merchant.status = 'payment_pending_verification';
      merchant.isActive = false;
      await merchant.save();

      await logAuditEvent({
        action: "MERCHANT_REGISTRATION_PAYMENT_SUCCESS",
        message: `Registration fee payment verified successfully for merchant: ${merchant.shopName}. Account activated.`,
        status: "success",
        merchantId: merchant._id,
        details: { razorpay_order_id, razorpay_payment_id },
        req,
      });

      return res.status(200).json({ success: true, message: "Payment verified successfully", merchant });
    } else {
      await logAuditEvent({
        action: "MERCHANT_REGISTRATION_PAYMENT_FAILED",
        message: `Registration fee signature verification failed for merchant ID: ${merchantId}`,
        status: "failure",
        merchantId,
        details: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        req,
      });
      return res.status(400).json({ success: false, message: "Invalid signature sent!" });
    }
  } catch (error) {
    console.error("Error verifying registration fee payment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
