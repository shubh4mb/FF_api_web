import ReturnIssue from "../../models/returnIssue.model.js";
import Order from "../../models/order.model.js";
import User from "../../models/user.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import Merchant from "../../models/merchant.model.js";
import { recordTransaction } from "../../helperFns/transactionHelper.js";
import { uploadToCloudinary } from "../../config/cloudinary.config.js";

// Get all return issues with pagination and search
export const getAllReturnIssues = async (req, res) => {
  try {
    const { status, merchantId, userId, riderId, page = 1, limit = 30 } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (merchantId) filter.merchantId = merchantId;
    if (userId) filter.userId = userId;
    if (riderId) filter.deliveryRiderId = riderId;

    const skip = (page - 1) * limit;

    const [issues, total] = await Promise.all([
      ReturnIssue.find(filter)
        .populate("merchantId", "shopName email phoneNumber status damageDisputeCount")
        .populate("userId", "name email phoneNumber isBlocked incidentCount")
        .populate("deliveryRiderId", "fullName name phone status incidentCount")
        .populate("orderId", "totalAmount orderStatus paymentMethod items")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ReturnIssue.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      issues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all return issues error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
};

// Deep investigation endpoint: Side-by-side evidence + 3-way historical metrics
export const getReturnIssueInvestigationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await ReturnIssue.findById(id)
      .populate("merchantId", "shopName email phoneNumber status isActive damageDisputeCount rejectedDisputeCount blockedReason")
      .populate("userId", "name email phoneNumber isBlocked blockedReason blockedIps deviceIds incidentCount createdAt")
      .populate("deliveryRiderId", "fullName name phone status isAvailable incidentCount blockedReason")
      .populate("orderId")
      .populate("compensationTransactionId", "transactionId amount paymentMethod referenceNumber status receipt notes createdAt")
      .lean();

    if (!issue) {
      return res.status(404).json({ success: false, message: "Return issue not found" });
    }

    const order = issue.orderId || {};
    const itemIdStr = issue.itemId?.toString();

    // 1. Merchant Packing Photos (baseline condition)
    let packingPhotos = [];
    if (order.packingPhotos && Array.isArray(order.packingPhotos)) {
      if (itemIdStr) {
        const itemPacking = order.packingPhotos.filter(
          (p) => p.itemId?.toString() === itemIdStr
        );
        packingPhotos = itemPacking.length > 0 ? itemPacking : order.packingPhotos;
      } else {
        packingPhotos = order.packingPhotos;
      }
    }

    // 2. Rider Return Photos (evidence collected from customer at return)
    let riderReturnPhotos = [];
    if (order.returnPhotos && Array.isArray(order.returnPhotos)) {
      if (itemIdStr) {
        const itemReturn = order.returnPhotos.filter(
          (p) => p.itemId?.toString() === itemIdStr
        );
        riderReturnPhotos = itemReturn.length > 0 ? itemReturn : order.returnPhotos;
      } else {
        riderReturnPhotos = order.returnPhotos;
      }
    }

    // 3. Merchant Damage Photos (evidence uploaded in this claim)
    const merchantDamagePhotos = issue.images || [];

    // 4. 3-Way Metrics Aggregation
    // User metrics
    let userStats = {
      totalOrders: 0,
      totalReturns: 0,
      totalDisputes: 0,
      disputeRatePercent: 0,
      riskLevel: "normal",
      isBlocked: !!issue.userId?.isBlocked,
    };

    if (issue.userId?._id) {
      const uId = issue.userId._id;
      const [uOrdersCount, uDisputesCount] = await Promise.all([
        Order.countDocuments({ userId: uId }),
        ReturnIssue.countDocuments({ userId: uId }),
      ]);

      const rate = uOrdersCount > 0 ? Math.round((uDisputesCount / uOrdersCount) * 100) : 0;
      let riskLevel = "normal";
      if (uDisputesCount >= 3 || rate >= 35) riskLevel = "critical";
      else if (uDisputesCount >= 2 || rate >= 20) riskLevel = "suspicious";

      userStats = {
        totalOrders: uOrdersCount,
        totalDisputes: uDisputesCount,
        disputeRatePercent: rate,
        riskLevel,
        isBlocked: !!issue.userId.isBlocked,
        blockedReason: issue.userId.blockedReason,
      };
    }

    // Rider metrics
    let riderStats = {
      totalDeliveries: 0,
      totalDisputes: 0,
      incidentRatePercent: 0,
      riskLevel: "clean",
      isSuspended: issue.deliveryRiderId?.status === "suspended" || issue.deliveryRiderId?.status === "blocked",
    };

    if (issue.deliveryRiderId?._id) {
      const rId = issue.deliveryRiderId._id;
      const [rOrdersCount, rDisputesCount] = await Promise.all([
        Order.countDocuments({ deliveryRiderId: rId, orderStatus: { $in: ["completed", "delivered", "selection_made"] } }),
        ReturnIssue.countDocuments({ deliveryRiderId: rId }),
      ]);

      const rate = rOrdersCount > 0 ? Math.round((rDisputesCount / rOrdersCount) * 100) : 0;
      let riskLevel = "clean";
      if (rDisputesCount >= 4 || rate >= 10) riskLevel = "high";
      else if (rDisputesCount >= 2 || rate >= 4) riskLevel = "watch";

      riderStats = {
        totalDeliveries: rOrdersCount,
        totalDisputes: rDisputesCount,
        incidentRatePercent: rate,
        riskLevel,
        isSuspended: issue.deliveryRiderId.status === "suspended" || issue.deliveryRiderId.status === "blocked",
        blockedReason: issue.deliveryRiderId.blockedReason,
      };
    }

    // Merchant metrics
    let merchantStats = {
      totalOrders: 0,
      totalDisputesFiled: 0,
      rejectedDisputes: 0,
      falseClaimPercent: 0,
      isSuspended: issue.merchantId?.status === "suspended" || !issue.merchantId?.isActive,
    };

    if (issue.merchantId?._id) {
      const mId = issue.merchantId._id;
      const [mOrdersCount, mDisputesCount, mRejectedCount] = await Promise.all([
        Order.countDocuments({ merchantId: mId }),
        ReturnIssue.countDocuments({ merchantId: mId }),
        ReturnIssue.countDocuments({ merchantId: mId, status: "rejected" }),
      ]);

      const falseRate = mDisputesCount > 0 ? Math.round((mRejectedCount / mDisputesCount) * 100) : 0;

      merchantStats = {
        totalOrders: mOrdersCount,
        totalDisputesFiled: mDisputesCount,
        rejectedDisputes: mRejectedCount,
        falseClaimPercent: falseRate,
        isSuspended: issue.merchantId.status === "suspended" || !issue.merchantId.isActive,
        blockedReason: issue.merchantId.blockedReason,
      };
    }

    return res.status(200).json({
      success: true,
      issue,
      evidence: {
        packingPhotos,
        riderReturnPhotos,
        merchantDamagePhotos,
      },
      stats: {
        user: userStats,
        rider: riderStats,
        merchant: merchantStats,
      },
    });
  } catch (error) {
    console.error("Get return issue investigation details error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch investigation details" });
  }
};

// Update issue status & admin actions
export const updateReturnIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, adminActionTaken } = req.body;

    const allowedStatuses = [
      "pending",
      "investigating",
      "resolved_merchant_compensated",
      "resolved_customer_fault",
      "resolved_rider_fault",
      "resolved",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const updatePayload = {
      status,
      resolutionNotes: resolutionNotes || "",
      adminActionTaken: adminActionTaken || "none",
      resolvedBy: req.adminId || null,
      resolvedAt: new Date(),
    };

    const issue = await ReturnIssue.findByIdAndUpdate(id, updatePayload, { new: true });

    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    // If status is rejected, increment merchant's rejectedDisputeCount
    if (status === "rejected" && issue.merchantId) {
      await Merchant.findByIdAndUpdate(issue.merchantId, { $inc: { rejectedDisputeCount: 1 } });
    }

    return res.status(200).json({
      success: true,
      message: "Issue updated successfully",
      issue,
    });
  } catch (error) {
    console.error("Update return issue error:", error);
    return res.status(500).json({ success: false, message: "Failed to update issue" });
  }
};

/**
 * POST /api/admin/return-issues/:id/refund-merchant
 * Disburse compensation/refund to merchant for a verified damaged/incident item.
 * Automatically records the transaction in the unified Transaction ledger.
 */
export const refundMerchantForIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      paymentMethod = "upi",
      referenceNumber,
      notes,
    } = req.body;

    const issue = await ReturnIssue.findById(id)
      .populate("merchantId")
      .populate("orderId");

    if (!issue) {
      return res.status(404).json({ success: false, message: "Return issue not found." });
    }

    if (issue.isMerchantRefunded) {
      return res.status(400).json({
        success: false,
        message: `Merchant has already been refunded ₹${issue.compensationAmount} for this issue.`,
      });
    }

    const parsedAmount = parseFloat(amount) || issue.itemDetails?.price || 0;
    if (parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid positive refund amount is required.",
      });
    }

    // Receipt upload if provided
    let receiptData = { url: null, public_id: null };
    if (req.file && req.file.buffer) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: "transactions/receipts",
        resource_type: "image",
      });
      receiptData = {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      };
    }

    const merchant = issue.merchantId;
    const recipientDetails = {
      name: merchant?.ownerName || merchant?.shopName || "Merchant",
      shopName: merchant?.shopName || "",
      phone: merchant?.phoneNumber || "",
      email: merchant?.email || "",
      bankName: merchant?.bankDetails?.bankName || "",
      accountNumber: merchant?.bankDetails?.accountNumber || "",
      ifscCode: merchant?.bankDetails?.ifscCode || "",
      upiId: merchant?.bankDetails?.upiId || "",
    };

    // 1. Record the transaction in the unified Transaction ledger
    const newTxn = await recordTransaction({
      amount: parsedAmount,
      type: "debit",
      category: "damage_compensation",
      source: "manual_admin",
      status: "completed",
      paymentMethod: paymentMethod || "upi",
      referenceNumber: referenceNumber?.trim() || null,
      recipientType: "merchant",
      recipientId: merchant?._id || issue.merchantId,
      recipientDetails,
      orderId: issue.orderId?._id || issue.orderId,
      receipt: receiptData,
      notes: notes?.trim() || `Damage compensation for item "${issue.itemDetails?.name || 'Damaged Item'}" (Order #${String(issue.orderId?._id || issue.orderId).slice(-6).toUpperCase()})`,
      performedBy: {
        adminId: req.admin?._id || null,
        name: req.admin?.name || "Admin",
        email: req.admin?.email || "",
      },
    });

    // 2. Update merchant earnings
    if (merchant) {
      merchant.earnings = merchant.earnings || { pendingBalance: 0, paidBalance: 0 };
      merchant.earnings.paidBalance = (merchant.earnings.paidBalance || 0) + parsedAmount;
      merchant.earnings.lastPayoutDate = new Date();
      await merchant.save();
    }

    // 3. Update ReturnIssue status
    issue.status = "resolved_merchant_compensated";
    issue.isMerchantRefunded = true;
    issue.compensationAmount = parsedAmount;
    issue.compensationTransactionId = newTxn._id;
    issue.compensationMethod = paymentMethod;
    issue.compensationReferenceNumber = referenceNumber?.trim() || null;
    issue.refundedAt = new Date();
    issue.resolvedAt = new Date();
    issue.resolvedBy = req.admin?._id || null;
    if (notes?.trim()) {
      issue.resolutionNotes = issue.resolutionNotes
        ? `${issue.resolutionNotes}\n\n[Compensation]: ${notes.trim()}`
        : notes.trim();
    }
    await issue.save();

    return res.status(200).json({
      success: true,
      message: `Successfully refunded ₹${parsedAmount} to merchant and recorded in ledger.`,
      transaction: newTxn,
      issue,
    });
  } catch (error) {
    console.error("Error refunding merchant for damage issue:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process merchant refund.",
    });
  }
};
