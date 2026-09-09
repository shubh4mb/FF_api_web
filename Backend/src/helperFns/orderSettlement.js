import ProductFlat from "../models/productFlat.model.js";
import Category from "../models/category.model.js";
import mongoose from "mongoose";
import { addToWeeklyPayout, incrementOrderCount } from "./weeklyPayoutHelper.js";
import AppConfig from "../models/appConfig.model.js";

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
            let product = await ProductFlat.findById(item.productId).select("categoryId subCategoryId").session(session);
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
        const hasReturns = order.items.some(i => i.tryStatus === "returned");
        const tipAmount = order.finalBilling?.deliveryTip || 0;

        const config = await AppConfig.getConfig();
        const waitingChargePerMinute = config.waitingChargePerMinute || 0;
        let waitingTimeCharge = 0;
        
        if (order.trialPhaseStart && order.trialPhaseEnd) {
            const waitingMinutes = Math.max(0, Math.floor((new Date(order.trialPhaseEnd) - new Date(order.trialPhaseStart)) / 60000));
            waitingTimeCharge = waitingMinutes * waitingChargePerMinute;
            order.waitingTimeCharge = waitingTimeCharge;
            // Optionally update trialPhaseDuration just in case it wasn't saved precisely
            order.trialPhaseDuration = waitingMinutes;
        }

        const deliveryFee = order.originalDeliveryCharge || order.deliveryCharge || 0;
        const returnFee = order.originalReturnCharge || order.returnCharge || 0;
        const riderPayout = deliveryFee + returnFee + tipAmount + waitingTimeCharge;

        if (riderPayout > 0) {
            // Check if any applied offer gave free delivery
            // Prioritize Merchant offer over Admin offer so delivery charge is funded from Merchant's fund
            const freeDeliveryOffers = (order.appliedOffers || []).filter(o => o.freeDelivery === true);
            const freeDeliveryOffer = freeDeliveryOffers.find(o => o.scope === "merchant") || freeDeliveryOffers.find(o => o.scope === "admin");
            
            // Only subsidize free delivery if the customer didn't pay the recovery fee
            // (If deliveryFeeRecovery was triggered and paid, the customer covered the cost)
            const deliveryFeeRecovered = order.deliveryFeeRecovery?.required && 
                ['paid_online', 'paid_via_qr', 'paid_cash'].includes(order.deliveryFeeRecovery?.status);
            
            if (freeDeliveryOffer && !deliveryFeeRecovered) {
                if (freeDeliveryOffer.scope === "merchant") {
                    merchantDiscount += riderPayout;
                } else if (freeDeliveryOffer.scope === "admin") {
                    adminDiscount += riderPayout;
                }
            }
        }
        
        // Admin subsidizes the waiting time compensation to the rider
        if (waitingTimeCharge > 0) {
            adminDiscount += waitingTimeCharge;
            // Persist the waiting time charge to the order document
            await order.save({ session });
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
        const riderPaidDirectly = order.deliveryFeeRecovery?.collectedByRider === true;
        
        if (riderPayout > 0 && order.deliveryRiderId) {
            if (riderPaidDirectly) {
                // Rider already received payment directly from customer via QR
                // Record ₹0 from FlashFits but note the direct collection amount for transparency
                await addToWeeklyPayout({
                    ownerType: "rider",
                    ownerId: order.deliveryRiderId,
                    orderId: order._id,
                    amount: 0,
                    type: "credit",
                    description: `Delivery for order ${order._id} (Collected ₹${riderPayout} directly from customer via QR)`,
                    session,
                });
            } else {
                // Normal flow: FlashFits pays rider via weekly payout
                await addToWeeklyPayout({
                    ownerType: "rider",
                    ownerId: order.deliveryRiderId,
                    orderId: order._id,
                    amount: riderPayout,
                    type: "credit",
                    description: `Delivery payout for order ${order._id}`,
                    session,
                });
            }

            // Track completed order count for incentive evaluation
            await incrementOrderCount({
                riderId: order.deliveryRiderId,
                cancelled: false,
                amount: riderPayout, // Always track full amount for incentive calc
                session
            });
        }

        // Mark as settled
        order.settlementStatus = "settled";
        
        if (!providedSession) {
            await order.save({ session });
            await session.commitTransaction();
            session.endSession();
        }

        // ── Referral System: Trigger reward if this is the user's first completed order ──
        if (order.userId) {
            try {
                const Order = mongoose.models.Order || mongoose.model("Order");
                const completedCount = await Order.countDocuments({
                    userId: order.userId,
                    settlementStatus: "settled"
                });
                
                // If count is 1, this is the first successfully settled order
                if (completedCount <= 1) {
                    const { handleFirstOrderCompletion } = await import("./referralHelper.js");
                    handleFirstOrderCompletion(order.userId).catch(err => console.error("Referral Reward Error:", err));
                }
            } catch (err) {
                console.error("Error triggering referral reward:", err);
            }
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
