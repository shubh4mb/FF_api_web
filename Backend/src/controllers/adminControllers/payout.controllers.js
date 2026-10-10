/**
 * payout.controllers.js
 *
 * Admin endpoints for viewing and managing weekly payouts.
 */

import WeeklyPayout from "../../models/weeklyPayout.model.js";
import Merchant from "../../models/merchant.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import Transaction from "../../models/transaction.model.js";
import { processWeeklyPayouts, getCurrentWeekBounds } from "../../helperFns/weeklyPayoutHelper.js";
import { recordTransaction } from "../../helperFns/transactionHelper.js";
import { uploadToCloudinary } from "../../config/cloudinary.config.js";

/**
 * Helper to enrich payout objects with recipient (Merchant / DeliveryRider) details.
 */
async function enrichPayoutsWithOwner(payouts) {
    if (!payouts || payouts.length === 0) return [];

    const merchantIds = payouts.filter(p => p.ownerType === "merchant").map(p => p.ownerId);
    const riderIds = payouts.filter(p => p.ownerType === "rider").map(p => p.ownerId);

    const [merchants, riders] = await Promise.all([
        merchantIds.length > 0
            ? Merchant.find({ _id: { $in: merchantIds } }, "shopName ownerName email phoneNumber bankDetails").lean()
            : [],
        riderIds.length > 0
            ? DeliveryRider.find({ _id: { $in: riderIds } }, "fullName phone email bankDetails upiId").lean()
            : [],
    ]);

    const merchantMap = new Map(merchants.map(m => [m._id.toString(), m]));
    const riderMap = new Map(riders.map(r => [r._id.toString(), r]));

    return payouts.map(p => {
        const idStr = p.ownerId?.toString();
        let ownerDetails = null;

        if (p.ownerType === "merchant" && merchantMap.has(idStr)) {
            const m = merchantMap.get(idStr);
            ownerDetails = {
                name: m.ownerName || m.shopName,
                shopName: m.shopName,
                email: m.email,
                phone: m.phoneNumber,
                bankDetails: m.bankDetails,
                accountHolderName: m.bankDetails?.accountHolderName || m.ownerName,
                accountNumber: m.bankDetails?.accountNumber,
                ifscCode: m.bankDetails?.ifscCode,
                bankName: m.bankDetails?.bankName,
                upiId: m.bankDetails?.upiId,
            };
        } else if (p.ownerType === "rider" && riderMap.has(idStr)) {
            const r = riderMap.get(idStr);
            ownerDetails = {
                name: r.fullName,
                email: r.email,
                phone: r.phone,
                bankDetails: r.bankDetails,
                accountHolderName: r.bankDetails?.accountHolderName || r.fullName,
                accountNumber: r.bankDetails?.accountNumber,
                ifscCode: r.bankDetails?.ifscCode,
                bankName: r.bankDetails?.bankName,
                upiId: r.upiId || r.bankDetails?.upiId,
            };
        }

        return {
            ...p,
            ownerDetails,
        };
    });
}

/**
 * GET /api/admin/payouts
 * View weekly payout summary with owner details & search support.
 * Query params: ?week=YYYY-MM-DD&type=rider|merchant&status=accumulating|finalized|paid|failed&search=...
 */
export const getPayouts = async (req, res) => {
    try {
        const { week, type, status, search, page = 1, limit = 50 } = req.query;

        const filter = {};

        if (type && type !== "all") filter.ownerType = type;
        if (status && status !== "all") filter.status = status;

        if (week) {
            const date = new Date(week);
            const { weekStart } = getCurrentWeekBounds(date);
            filter.weekStart = weekStart;
        }

        if (search && search.trim()) {
            const term = search.trim();
            const regex = new RegExp(term, "i");

            const [matchedMerchants, matchedRiders] = await Promise.all([
                Merchant.find({
                    $or: [
                        { shopName: regex },
                        { ownerName: regex },
                        { email: regex },
                        { phoneNumber: regex },
                    ],
                }, "_id").lean(),
                DeliveryRider.find({
                    $or: [
                        { fullName: regex },
                        { email: regex },
                        { phone: regex },
                    ],
                }, "_id").lean(),
            ]);

            const ownerIds = [
                ...matchedMerchants.map(m => m._id),
                ...matchedRiders.map(r => r._id),
            ];

            const orConditions = [{ ownerId: { $in: ownerIds } }];
            // Also allow matching by hex ID
            if (/^[0-9a-fA-F]{24}$/.test(term)) {
                orConditions.push({ _id: term });
            }
            // Reference number match
            orConditions.push({ referenceNumber: regex });

            filter.$or = orConditions;
        }

        const rawPayouts = await WeeklyPayout.find(filter)
            .sort({ weekStart: -1, ownerType: 1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        const total = await WeeklyPayout.countDocuments(filter);
        const payouts = await enrichPayoutsWithOwner(rawPayouts);

        // Summary stats across matching records
        const allMatching = await WeeklyPayout.find(filter, "totalEarnings totalDeductions totalIncentive finalAmount status").lean();
        const summary = {
            totalRecords: total,
            totalEarnings: allMatching.reduce((s, p) => s + (p.totalEarnings || 0), 0),
            totalDeductions: allMatching.reduce((s, p) => s + (p.totalDeductions || 0), 0),
            totalIncentives: allMatching.reduce((s, p) => s + (p.totalIncentive || 0), 0),
            totalFinalAmount: allMatching.reduce((s, p) => s + (p.finalAmount || 0), 0),
            pendingApprovalCount: allMatching.filter(p => p.status === "finalized").length,
            paidCount: allMatching.filter(p => p.status === "paid").length,
            accumulatingCount: allMatching.filter(p => p.status === "accumulating").length,
        };

        return res.status(200).json({
            success: true,
            payouts,
            summary,
            pagination: { page: parseInt(page), limit: parseInt(limit), total },
        });
    } catch (error) {
        console.error("Get payouts error:", error);
        return res.status(500).json({ message: "Failed to fetch payouts." });
    }
};

/**
 * POST /api/admin/payouts/trigger
 * Manually trigger weekly payout processing. For testing/admin use.
 */
export const triggerPayout = async (req, res) => {
    try {
        console.log("[Admin] Manual payout trigger initiated.");
        const result = await processWeeklyPayouts();

        return res.status(200).json({
            success: true,
            message: "Payout processing completed.",
            ...result,
        });
    } catch (error) {
        console.error("Trigger payout error:", error);
        return res.status(500).json({ message: "Failed to trigger payout." });
    }
};

/**
 * GET /api/admin/payouts/:id
 * Get detailed payout record (with full order breakdown and recipient details).
 */
export const getPayoutById = async (req, res) => {
    try {
        const rawPayout = await WeeklyPayout.findById(req.params.id).lean();
        if (!rawPayout) {
            return res.status(404).json({ message: "Payout not found." });
        }

        const [payout] = await enrichPayoutsWithOwner([rawPayout]);

        // If transaction linked, fetch it
        let linkedTransaction = null;
        if (payout.transactionId) {
            linkedTransaction = await Transaction.findOne({ transactionId: payout.transactionId }).lean();
        } else {
            linkedTransaction = await Transaction.findOne({ weeklyPayoutId: payout._id }).lean();
        }

        return res.status(200).json({
            success: true,
            payout,
            transaction: linkedTransaction,
        });
    } catch (error) {
        console.error("Get payout by id error:", error);
        return res.status(500).json({ message: "Failed to fetch payout." });
    }
};

/**
 * POST /api/admin/payouts/:id/mark-paid
 * Mark a finalized payout as paid with receipt/bill upload, reference number,
 * and auto-log in the Transaction ledger.
 */
export const markPayoutPaid = async (req, res) => {
    try {
        const {
            adminDeductionAmount,
            adminDeductionReason,
            referenceNumber,
            paymentMethod,
            notes,
            receiptUrl,
        } = req.body;

        const payout = await WeeklyPayout.findById(req.params.id);

        if (!payout) {
            return res.status(404).json({ message: "Payout not found." });
        }

        if (payout.status !== "finalized") {
            return res.status(400).json({ 
                message: `Payout cannot be marked as paid. Current status is ${payout.status}.` 
            });
        }

        const deductionAmount = parseFloat(adminDeductionAmount) || 0;

        if (deductionAmount > 0) {
            if (!adminDeductionReason) {
                return res.status(400).json({ message: "Reason is required for admin deduction." });
            }
            if (deductionAmount > payout.finalAmount && payout.finalAmount > 0) {
                return res.status(400).json({ message: "Deduction cannot exceed final amount." });
            }

            payout.adminDeduction = {
                amount: deductionAmount,
                reason: adminDeductionReason,
            };

            payout.totalDeductions += deductionAmount;
            payout.netPayout -= deductionAmount;
            payout.finalAmount -= deductionAmount;
        }

        // Receipt upload to Cloudinary (optional)
        let receiptData = { url: null, public_id: null };
        if (req.file && req.file.buffer) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, {
                    folder: "payouts/receipts",
                    resource_type: "image",
                });
                receiptData = {
                    url: uploadResult.secure_url,
                    public_id: uploadResult.public_id,
                };
            } catch (upErr) {
                console.error("Cloudinary payout receipt upload failed:", upErr.message);
            }
        } else if (receiptUrl) {
            receiptData = { url: receiptUrl, public_id: null };
        }

        payout.status = "paid";
        payout.paidAt = new Date();
        payout.receipt = receiptData;
        payout.referenceNumber = referenceNumber?.trim() || null;
        payout.paymentMethod = paymentMethod || "bank_transfer";
        payout.notes = notes?.trim() || "";

        // ── Auto-record in centralized Transaction ledger ──
        let newTxn = null;
        try {
            let recipientDetails = {};

            if (payout.ownerType === "merchant") {
                const merchant = await Merchant.findById(payout.ownerId);
                if (merchant) {
                    recipientDetails = {
                        name: merchant.ownerName || merchant.shopName,
                        shopName: merchant.shopName,
                        phone: merchant.phoneNumber,
                        email: merchant.email,
                        bankName: merchant.bankDetails?.bankName,
                        accountNumber: merchant.bankDetails?.accountNumber,
                        ifscCode: merchant.bankDetails?.ifscCode,
                        upiId: merchant.bankDetails?.upiId,
                    };
                    merchant.earnings = merchant.earnings || { pendingBalance: 0, paidBalance: 0 };
                    merchant.earnings.paidBalance = (merchant.earnings.paidBalance || 0) + Math.max(0, payout.finalAmount);
                    merchant.earnings.pendingBalance = Math.max(0, (merchant.earnings.pendingBalance || 0) - Math.max(0, payout.finalAmount));
                    merchant.earnings.lastPayoutDate = new Date();
                    await merchant.save();
                }
            } else if (payout.ownerType === "rider") {
                const rider = await DeliveryRider.findById(payout.ownerId);
                if (rider) {
                    recipientDetails = {
                        name: rider.fullName,
                        phone: rider.phone,
                        email: rider.email,
                        bankName: rider.bankDetails?.bankName,
                        accountNumber: rider.bankDetails?.accountNumber,
                        ifscCode: rider.bankDetails?.ifscCode,
                        upiId: rider.upiId || rider.bankDetails?.upiId,
                    };
                }
            }

            const formattedWeek = payout.weekStart ? new Date(payout.weekStart).toLocaleDateString() : "";
            newTxn = await recordTransaction({
                amount: Math.max(0.01, Math.abs(payout.finalAmount)),
                type: "debit",
                category: payout.ownerType === "merchant" ? "merchant_payout" : "rider_payout",
                source: "manual_admin",
                status: "completed",
                paymentMethod: payout.paymentMethod,
                referenceNumber: payout.referenceNumber,
                recipientType: payout.ownerType,
                recipientId: payout.ownerId,
                recipientDetails,
                weeklyPayoutId: payout._id,
                receipt: receiptData,
                notes: notes || `Weekly Payout marked paid by Admin for ${payout.ownerType} (Cycle: ${formattedWeek})`,
                performedBy: {
                    adminId: req.admin?._id,
                    name: req.admin?.name || "Admin",
                    email: req.admin?.email || "",
                },
            });

            if (newTxn?.transactionId) {
                payout.transactionId = newTxn.transactionId;
            }
        } catch (txnError) {
            console.warn("Could not auto-record Transaction for payout:", txnError.message);
        }

        await payout.save();

        const [enriched] = await enrichPayoutsWithOwner([payout.toObject()]);

        return res.status(200).json({
            success: true,
            message: "Payout successfully marked as paid and logged in ledger.",
            payout: enriched,
            transaction: newTxn,
        });
    } catch (error) {
        console.error("Error marking payout as paid:", error);
        return res.status(500).json({ message: "Failed to mark payout as paid." });
    }
};

/**
 * GET /api/admin/payouts/pending
 * Get all finalized payouts waiting to be paid, enriched with owner & bank details.
 * Query params: ?ownerType=rider|merchant
 */
export const getPendingPayouts = async (req, res) => {
    try {
        const { ownerType } = req.query;
        const filter = { status: "finalized" };

        if (ownerType && ownerType !== "all") {
            filter.ownerType = ownerType;
        }

        const rawPayouts = await WeeklyPayout.find(filter)
            .sort({ weekStart: -1, ownerType: 1 })
            .lean();

        const payouts = await enrichPayoutsWithOwner(rawPayouts);

        return res.status(200).json({
            success: true,
            count: payouts.length,
            payouts,
        });
    } catch (error) {
        console.error("Get pending payouts error:", error);
        return res.status(500).json({ message: "Failed to fetch pending payouts." });
    }
};
