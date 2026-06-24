import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import mongoose from "mongoose";
import { addToWeeklyPayout, incrementOrderCount } from "./weeklyPayoutHelper.js";

/**
 * Calculates and distributes funds to merchant, rider, and admin wallets
 * based on the final accepted items in the order.
 * 
 * Merchant & Rider payouts go into the WeeklyPayout ledger (paid out on payout day).
 * Admin commission is credited instantly (platform revenue).
 * 
 * @param {Object} order The Mongoose order document
 * @param {Object} [providedSession] Optional mongoose session
 */
export const settleOrder = async (order, providedSession = null) => {
    // If it's already settled or failed, don't settle again (Idempotency)
    if (order.settlementStatus === "settled") {
        console.log(`Order ${order._id} already settled, skipping.`);
        return true;
    }

    const session = providedSession || await mongoose.startSession();
    if (!providedSession) {
        session.startTransaction();
    }

    try {
        let totalCommission = 0;
        let totalMerchantPayout = 0;
        let adminDiscount = 0;
        let merchantDiscount = 0;

        // 1. Calculate item splits (Revenue & Commission)
        const acceptedItems = order.items.filter(
            item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
        );

        for (const item of acceptedItems) {
            const product = await Product.findById(item.productId).select("categoryId subCategoryId").session(session);
            if (!product) continue;

            let commissionPercentage = 0;
            if (product.subCategoryId) {
                const category = await Category.findById(product.subCategoryId).select("commissionPercentage").session(session);
                if (category && category.commissionPercentage) {
                    commissionPercentage = category.commissionPercentage;
                }
            }

            const itemTotal = item.price * item.quantity;
            const commissionAmount = (itemTotal * commissionPercentage) / 100;
            const merchantAmount = itemTotal - commissionAmount;

            totalCommission += commissionAmount;
            totalMerchantPayout += merchantAmount;
        }

        // 2. Process Applied Coupons/Discounts
        for (const offer of (order.appliedOffers || [])) {
            if (offer.scope === "admin") {
                adminDiscount += (offer.discountApplied || 0);
            } else if (offer.scope === "merchant") {
                merchantDiscount += (offer.discountApplied || 0);
            }
        }

        // 3. Handle Rider Payout & Free Delivery Costing
        // Rider always gets paid the original charges (even if customer got free delivery)
        // Tip is always passed through to rider regardless of offers
        const hasReturns = order.items.some(i => i.tryStatus === "returned");
        const tipAmount = order.finalBilling?.deliveryTip || 0;
        const riderPayout = (order.originalDeliveryCharge || 0) 
            + (hasReturns ? (order.originalReturnCharge || 0) : 0)
            + tipAmount;

        if (riderPayout > 0) {
            // Who pays for this? (Check if any applied offer gave free delivery)
            const freeDeliveryOffer = (order.appliedOffers || []).find(o => o.freeDelivery === true);
            if (freeDeliveryOffer) {
                if (freeDeliveryOffer.scope === "admin") {
                    adminDiscount += riderPayout;
                } else if (freeDeliveryOffer.scope === "merchant") {
                    merchantDiscount += riderPayout;
                }
            }
        }

        // 4. Final Payout Calculations
        const finalMerchantPayout = totalMerchantPayout - merchantDiscount;
        const finalAdminPayout = totalCommission - adminDiscount;

        // 5. Execute Transactions

        // ── Merchant: goes into Weekly Payout ledger ──
        if (finalMerchantPayout !== 0 && order.merchantId) {
            await addToWeeklyPayout({
                ownerType: "merchant",
                ownerId: order.merchantId,
                orderId: order._id,
                amount: Math.abs(finalMerchantPayout),
                type: finalMerchantPayout > 0 ? "credit" : "debit",
                description: finalMerchantPayout > 0
                    ? `Payout for order ${order._id}`
                    : `Discount cost for order ${order._id}`,
                session,
            });
        }

        // ── Admin: instant credit/debit (platform revenue) ──
        if (finalAdminPayout !== 0) {
            const { creditWallet, debitWallet } = await import("./walletHelper.js");
            const Admin = (await import("../models/admin.model.js")).default;
            const firstAdmin = await Admin.findOne({ role: "superadmin" }).session(session);
            if (firstAdmin) {
                if (finalAdminPayout > 0) {
                    await creditWallet({
                        ownerType: "admin",
                        ownerId: firstAdmin._id,
                        amount: finalAdminPayout,
                        description: `Commission for order ${order._id}`,
                        orderId: order._id,
                        session
                    });
                } else {
                    await debitWallet({
                        ownerType: "admin",
                        ownerId: firstAdmin._id,
                        amount: Math.abs(finalAdminPayout),
                        description: `Discount cost for order ${order._id}`,
                        orderId: order._id,
                        session,
                        allowNegative: true
                    });
                }
            }
        }

        // ── Rider: goes into Weekly Payout ledger ──
        if (riderPayout > 0 && order.deliveryRiderId) {
            await addToWeeklyPayout({
                ownerType: "rider",
                ownerId: order.deliveryRiderId,
                orderId: order._id,
                amount: riderPayout,
                type: "credit",
                description: `Delivery payout for order ${order._id}`,
                session,
            });

            // Track completed order count for incentive evaluation
            await incrementOrderCount(order.deliveryRiderId, false, riderPayout, session);
        }

        // Mark as settled
        order.settlementStatus = "settled";
        
        if (!providedSession) {
            await order.save({ session });
            await session.commitTransaction();
            session.endSession();
        }
        
        return true;
    } catch (error) {
        console.error(`[Settlement Error] Order ID: ${order._id} - Details:`, error.message);
        
        if (!providedSession) {
            await session.abortTransaction();
            session.endSession();
            
            order.settlementStatus = "failed";
            await order.save().catch(e => console.error("Failed to mark order as failed:", e));
        } else {
            throw error;
        }
        
        return false;
    }
};
