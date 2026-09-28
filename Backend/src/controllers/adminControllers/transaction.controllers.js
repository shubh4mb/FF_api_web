import mongoose from "mongoose";
import Transaction from "../../models/transaction.model.js";
import Merchant from "../../models/merchant.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import User from "../../models/user.model.js";
import Order from "../../models/order.model.js";
import CourierOrder from "../../models/courierOrder.model.js";
import WeeklyPayout from "../../models/weeklyPayout.model.js";
import { recordTransaction } from "../../helperFns/transactionHelper.js";
import { uploadToCloudinary } from "../../config/cloudinary.config.js";

/**
 * POST /api/admin/transactions/manual
 * Record a manual financial transaction (Merchant payout, Rider payout, User refund, Customer payment, etc.)
 */
export const createManualTransaction = async (req, res) => {
  try {
    const {
      amount,
      category,
      type: explicitType,
      paymentMethod,
      referenceNumber,
      recipientType,
      recipientId,
      orderId,
      weeklyPayoutId,
      notes,
    } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid positive transaction amount is required.",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Transaction category is required.",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method (UPI, Bank Transfer, Cash, etc.) is required.",
      });
    }

    if (!recipientType) {
      return res.status(400).json({
        success: false,
        message: "Recipient type (merchant, rider, user, platform, other) is required.",
      });
    }

    // Determine type: debit (outflow) or credit (inflow)
    let type = explicitType;
    if (!type || !["credit", "debit"].includes(type)) {
      if (
        [
          "merchant_payout",
          "rider_payout",
          "user_refund",
          "damage_compensation",
        ].includes(category)
      ) {
        type = "debit";
      } else {
        type = "credit";
      }
    }

    // Parse recipientDetails if passed as JSON string (from FormData)
    let parsedRecipientDetails = {};
    if (typeof req.body.recipientDetails === "string") {
      try {
        parsedRecipientDetails = JSON.parse(req.body.recipientDetails);
      } catch (e) {
        parsedRecipientDetails = {};
      }
    } else if (typeof req.body.recipientDetails === "object") {
      parsedRecipientDetails = req.body.recipientDetails || {};
    }

    // Auto-fetch recipient snapshot if recipientId is supplied and fields are missing
    if (recipientId && mongoose.Types.ObjectId.isValid(recipientId)) {
      if (recipientType === "merchant") {
        const m = await Merchant.findById(recipientId);
        if (m) {
          parsedRecipientDetails.name = parsedRecipientDetails.name || m.ownerName || m.shopName;
          parsedRecipientDetails.shopName = parsedRecipientDetails.shopName || m.shopName;
          parsedRecipientDetails.phone = parsedRecipientDetails.phone || m.phoneNumber;
          parsedRecipientDetails.email = parsedRecipientDetails.email || m.email;
          parsedRecipientDetails.bankName = parsedRecipientDetails.bankName || m.bankDetails?.bankName;
          parsedRecipientDetails.accountNumber = parsedRecipientDetails.accountNumber || m.bankDetails?.accountNumber;
          parsedRecipientDetails.ifscCode = parsedRecipientDetails.ifscCode || m.bankDetails?.ifscCode;
          parsedRecipientDetails.upiId = parsedRecipientDetails.upiId || m.bankDetails?.upiId;
        }
      } else if (recipientType === "rider") {
        const r = await DeliveryRider.findById(recipientId);
        if (r) {
          parsedRecipientDetails.name = parsedRecipientDetails.name || r.fullName;
          parsedRecipientDetails.phone = parsedRecipientDetails.phone || r.phone;
          parsedRecipientDetails.email = parsedRecipientDetails.email || r.email;
          parsedRecipientDetails.bankName = parsedRecipientDetails.bankName || r.bankDetails?.bankName;
          parsedRecipientDetails.accountNumber = parsedRecipientDetails.accountNumber || r.bankDetails?.accountNumber;
          parsedRecipientDetails.ifscCode = parsedRecipientDetails.ifscCode || r.bankDetails?.ifscCode;
          parsedRecipientDetails.upiId = parsedRecipientDetails.upiId || r.upiId;
        }
      } else if (recipientType === "user") {
        const u = await User.findById(recipientId);
        if (u) {
          parsedRecipientDetails.name = parsedRecipientDetails.name || u.name;
          parsedRecipientDetails.phone = parsedRecipientDetails.phone || u.phoneNumber;
          parsedRecipientDetails.email = parsedRecipientDetails.email || u.email;
        }
      }
    }

    // Receipt upload to Cloudinary (optional)
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

    // Performed by admin
    const performedBy = {
      adminId: req.admin?._id || null,
      name: req.admin?.name || "Admin",
      email: req.admin?.email || "",
    };

    // Create the transaction
    const newTxn = await recordTransaction({
      amount: parsedAmount,
      type,
      category,
      source: "manual_admin",
      status: "completed",
      paymentMethod,
      referenceNumber: referenceNumber?.trim() || null,
      recipientType,
      recipientId: recipientId && mongoose.Types.ObjectId.isValid(recipientId) ? recipientId : null,
      recipientDetails: parsedRecipientDetails,
      orderId: orderId && mongoose.Types.ObjectId.isValid(orderId) ? orderId : null,
      weeklyPayoutId: weeklyPayoutId && mongoose.Types.ObjectId.isValid(weeklyPayoutId) ? weeklyPayoutId : null,
      receipt: receiptData,
      notes: notes?.trim() || "",
      performedBy,
    });

    // ── Apply Ledger & Balance Side-Effects ──
    try {
      // 1. Merchant Payout Updates
      if (recipientType === "merchant" && recipientId && mongoose.Types.ObjectId.isValid(recipientId)) {
        const merchant = await Merchant.findById(recipientId);
        if (merchant) {
          merchant.earnings = merchant.earnings || { pendingBalance: 0, paidBalance: 0 };
          merchant.earnings.paidBalance = (merchant.earnings.paidBalance || 0) + parsedAmount;
          if (category === "merchant_payout") {
            merchant.earnings.pendingBalance = Math.max(0, (merchant.earnings.pendingBalance || 0) - parsedAmount);
            merchant.earnings.lastPayoutDate = new Date();
          }
          await merchant.save();
        }

        // If linked to WeeklyPayout, mark as paid
        if (weeklyPayoutId && mongoose.Types.ObjectId.isValid(weeklyPayoutId)) {
          await WeeklyPayout.findByIdAndUpdate(weeklyPayoutId, {
            status: "paid",
            paidAt: new Date(),
          });
        }
      }

      // 2. Rider Payout Updates
      if (recipientType === "rider" && weeklyPayoutId && mongoose.Types.ObjectId.isValid(weeklyPayoutId)) {
        await WeeklyPayout.findByIdAndUpdate(weeklyPayoutId, {
          status: "paid",
          paidAt: new Date(),
        });
      }

      // 3. User Refund Updates
      if (recipientType === "user" && category === "user_refund" && orderId && mongoose.Types.ObjectId.isValid(orderId)) {
        const refundUpdate = {
          paymentStatus: "refunded",
          refundAmount: parsedAmount,
          refundDetails: {
            amount: parsedAmount,
            method: paymentMethod,
            referenceNumber: referenceNumber?.trim() || null,
            refundedAt: new Date(),
            reason: notes?.trim() || "Customer refund processed",
            transactionId: newTxn._id,
          },
        };
        await Promise.allSettled([
          Order.findByIdAndUpdate(orderId, refundUpdate),
          CourierOrder.findByIdAndUpdate(orderId, refundUpdate),
        ]);
      }
    } catch (sideEffectError) {
      console.error("Warning: side-effect balance update error:", sideEffectError);
      // We don't fail the transaction creation because the record is already safely logged
    }

    return res.status(201).json({
      success: true,
      message: "Transaction successfully recorded.",
      transaction: newTxn,
    });
  } catch (error) {
    console.error("Error creating manual transaction:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record manual transaction.",
    });
  }
};

/**
 * GET /api/admin/transactions
 * Retrieve paginated financial transactions with filtering, search, and KPI aggregates.
 */
export const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      category = "all",
      type = "all",
      source = "all",
      paymentMethod = "all",
      recipientType = "all",
      startDate,
      endDate,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (category && category !== "all") {
      query.category = category;
    }

    if (type && type !== "all") {
      query.type = type;
    }

    if (source && source !== "all") {
      query.source = source;
    }

    if (paymentMethod && paymentMethod !== "all") {
      query.paymentMethod = paymentMethod;
    }

    if (recipientType && recipientType !== "all") {
      query.recipientType = recipientType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Text search
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { transactionId: searchRegex },
        { referenceNumber: searchRegex },
        { "recipientDetails.name": searchRegex },
        { "recipientDetails.shopName": searchRegex },
        { "recipientDetails.phone": searchRegex },
        { "recipientDetails.accountNumber": searchRegex },
        { "recipientDetails.upiId": searchRegex },
        { notes: searchRegex },
      ];
    }

    // Total count for current query
    const total = await Transaction.countDocuments(query);

    // Fetch items with sort
    const transactions = await Transaction.find(query)
      .populate("orderId", "totalAmount orderStatus paymentStatus")
      .populate("weeklyPayoutId", "weekStart weekEnd finalAmount status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Aggregations for top KPI summary
    // We compute both overall KPI metrics and filtered KPI metrics
    const [aggregateMetrics] = await Transaction.aggregate([
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalInflow: {
                  $sum: {
                    $cond: [
                      { $and: [{ $eq: ["$type", "credit"] }, { $eq: ["$status", "completed"] }] },
                      "$amount",
                      0,
                    ],
                  },
                },
                totalOutflow: {
                  $sum: {
                    $cond: [
                      { $and: [{ $eq: ["$type", "debit"] }, { $eq: ["$status", "completed"] }] },
                      "$amount",
                      0,
                    ],
                  },
                },
                totalRefunds: {
                  $sum: {
                    $cond: [{ $eq: ["$category", "user_refund"] }, "$amount", 0],
                  },
                },
                totalMerchantPayouts: {
                  $sum: {
                    $cond: [{ $eq: ["$category", "merchant_payout"] }, "$amount", 0],
                  },
                },
                totalRiderPayouts: {
                  $sum: {
                    $cond: [{ $eq: ["$category", "rider_payout"] }, "$amount", 0],
                  },
                },
                manualCount: {
                  $sum: {
                    $cond: [{ $eq: ["$source", "manual_admin"] }, 1, 0],
                  },
                },
                totalTransactions: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const summaryData = aggregateMetrics?.overall?.[0] || {
      totalInflow: 0,
      totalOutflow: 0,
      totalRefunds: 0,
      totalMerchantPayouts: 0,
      totalRiderPayouts: 0,
      manualCount: 0,
      totalTransactions: 0,
    };

    summaryData.netBalance = summaryData.totalInflow - summaryData.totalOutflow;

    return res.status(200).json({
      success: true,
      transactions,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
      summary: summaryData,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions.",
    });
  }
};

/**
 * GET /api/admin/transactions/recipients
 * Quick search endpoint to autocomplete recipient info in manual transaction modal.
 */
export const getRecipients = async (req, res) => {
  try {
    const { type = "merchant", query = "" } = req.query;
    const searchRegex = new RegExp(query.trim(), "i");

    let results = [];

    if (type === "merchant") {
      const merchants = await Merchant.find({
        $or: [
          { shopName: searchRegex },
          { ownerName: searchRegex },
          { phoneNumber: searchRegex },
        ],
      })
        .select("_id shopName ownerName phoneNumber email bankDetails earnings")
        .limit(15)
        .lean();

      results = merchants.map((m) => ({
        _id: m._id,
        name: m.ownerName || m.shopName,
        shopName: m.shopName,
        phone: m.phoneNumber,
        email: m.email,
        bankName: m.bankDetails?.bankName || "",
        accountNumber: m.bankDetails?.accountNumber || "",
        ifscCode: m.bankDetails?.ifscCode || "",
        upiId: m.bankDetails?.upiId || "",
        pendingBalance: m.earnings?.pendingBalance || 0,
        paidBalance: m.earnings?.paidBalance || 0,
        type: "merchant",
      }));
    } else if (type === "rider") {
      const riders = await DeliveryRider.find({
        $or: [
          { fullName: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
        ],
      })
        .select("_id fullName phone email bankDetails upiId status")
        .limit(15)
        .lean();

      results = riders.map((r) => ({
        _id: r._id,
        name: r.fullName,
        phone: r.phone,
        email: r.email,
        bankName: r.bankDetails?.bankName || "",
        accountNumber: r.bankDetails?.accountNumber || "",
        ifscCode: r.bankDetails?.ifscCode || "",
        upiId: r.upiId || "",
        type: "rider",
      }));
    } else if (type === "user") {
      const users = await User.find({
        $or: [
          { name: searchRegex },
          { phoneNumber: searchRegex },
          { email: searchRegex },
        ],
      })
        .select("_id name phoneNumber email")
        .limit(15)
        .lean();

      results = users.map((u) => ({
        _id: u._id,
        name: u.name || "Customer",
        phone: u.phoneNumber,
        email: u.email,
        type: "user",
      }));
    }

    return res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error searching recipients:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search recipients.",
    });
  }
};

/**
 * GET /api/admin/transactions/:id
 * Retrieve details for a single transaction.
 */
export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    let txn = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      txn = await Transaction.findById(id)
        .populate("orderId")
        .populate("weeklyPayoutId")
        .populate("performedBy.adminId", "name email");
    } else {
      txn = await Transaction.findOne({ transactionId: id })
        .populate("orderId")
        .populate("weeklyPayoutId")
        .populate("performedBy.adminId", "name email");
    }

    if (!txn) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    return res.status(200).json({
      success: true,
      transaction: txn,
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction details.",
    });
  }
};
