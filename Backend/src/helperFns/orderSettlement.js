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
        let totalGrossSales = 0;
        let totalCommission = 0;
        let totalMerchantPayout = 0;
        let adminDiscount = 0;
        let merchantDiscount = 0;

        // 1. Calculate item splits (Revenue & Commission)
        const acceptedItems = order.items.filter(
            item => item.status !== "out_of_stock" && (item.tryStatus === "accepted" || item.tryStatus === "keep" || item.tryStatus === "not-triable")
        );

        for (const item of acceptedItems) {
            let product = await ProductFlat.findById(item.productId || item.variantId).select("categoryId subCategoryId").session(session);

            let commissionPercentage = 4; // Default launch baseline is 4%
            if (product?.subCategoryId) {
                const category = await Category.findById(product.subCategoryId).select("commissionPercentage").session(session);
                if (category && typeof category.commissionPercentage === "number" && category.commissionPercentage > 0) {
                    commissionPercentage = category.commissionPercentage;
                }
            } else if (product?.categoryId) {
                const category = await Category.findById(product.categoryId).select("commissionPercentage").session(session);
                if (category && typeof category.commissionPercentage === "number" && category.commissionPercentage > 0) {
                    commissionPercentage = category.commissionPercentage;
                }
            }

            const itemTotal = item.price * (item.quantity || 1);
            totalGrossSales += itemTotal;
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
        // Cap merchant discount to total items payout (merchant cannot owe discount on 0 items sold)
        merchantDiscount = Math.min(merchantDiscount, totalMerchantPayout);

        // 3. Handle Rider Payout & Free Delivery Costing
        const hasReturns = order.items.some(i => i.status !== "out_of_stock" && i.tryStatus === "returned");
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
                    // Merchant only covers the delivery fee (and return fee if explicitly free return), NOT rider tip or overtime waiting charge
                    const merchantDeliveryDiscount = (freeDeliveryOffer.freeReturn ? (deliveryFee + returnFee) : deliveryFee);
                    merchantDiscount += merchantDeliveryDiscount;
                    merchantDiscount = Math.min(merchantDiscount, totalMerchantPayout);
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
        const finalMerchantPayout = Math.max(0, totalMerchantPayout - merchantDiscount);
        const finalAdminPayout = totalCommission - adminDiscount;
        const isWarehouse = Boolean(order.warehouseId || order.fulfillmentType);

        // Store settlement breakdown directly on order document for immutable financial auditing
        order.commissionRate = 4;
        order.commissionAmount = totalCommission;
        order.merchantPayout = finalMerchantPayout;
        order.settlementBreakdown = {
            grossAmount: totalGrossSales,
            commissionRate: 4,
            commissionAmount: totalCommission,
            merchantPayout: finalMerchantPayout,
            merchantDiscount: merchantDiscount,
            adminDiscount: adminDiscount,
            deliveryFee: deliveryFee,
            returnFee: returnFee,
            riderPayout: riderPayout,
            settledAt: new Date(),
        };

        // 5. Execute Transactions

        // ── Merchant: goes into Weekly Payout ledger ──
        const effectiveMerchantId = order.merchantId || order.sourceMerchantId;
        if (finalMerchantPayout !== 0 && effectiveMerchantId) {
            await addToWeeklyPayout({
                ownerType: "merchant",
                ownerId: effectiveMerchantId,
                orderId: order._id,
                orderModel: isWarehouse ? "WarehouseOrder" : "Order",
                amount: Math.abs(finalMerchantPayout),
                grossAmount: totalGrossSales,
                commissionRate: 4,
                commissionAmount: totalCommission,
                merchantDiscount: merchantDiscount,
                type: finalMerchantPayout > 0 ? "credit" : "debit",
                description: finalMerchantPayout > 0
                    ? `Payout for order #${order._id.toString().slice(-6).toUpperCase()} (${acceptedItems.length} item${acceptedItems.length === 1 ? '' : 's'} purchased)`
                    : `Discount cost for order #${order._id.toString().slice(-6).toUpperCase()}`,
                session,
            });

            // Update merchant's pending earnings balance
            const Merchant = (await import("../models/merchant.model.js")).default;
            await Merchant.findByIdAndUpdate(
                effectiveMerchantId,
                { $inc: { 'earnings.pendingBalance': finalMerchantPayout } },
                { session }
            );
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

        // ── Auto-record Inflow in Unified Transaction Ledger with full split breakdown ──
        try {
            const { recordTransaction } = await import("./transactionHelper.js");
            const paymentAmount = order.finalBilling?.totalPayable ?? order.totalAmount ?? 0;
            if (paymentAmount > 0) {
                await recordTransaction({
                    amount: paymentAmount,
                    type: "credit",
                    category: "customer_payment",
                    source: order.paymentMethod === "cod" ? "system_cod" : "system_razorpay",
                    status: "completed",
                    paymentMethod: order.paymentMethod === "cod" ? "cash" : "razorpay",
                    referenceNumber: order.razorpayPaymentId || null,
                    recipientType: "user",
                    recipientId: order.userId,
                    recipientDetails: {
                        name: order.deliveryLocation?.name || "",
                        phone: order.deliveryLocation?.phone || "",
                    },
                    orderId: order._id,
                    orderModel: isWarehouse ? "WarehouseOrder" : "Order",
                    warehouseOrderId: isWarehouse ? order._id : null,
                    split: {
                        grossAmount: totalGrossSales,
                        commissionRate: 4,
                        commissionAmount: totalCommission,
                        merchantAmount: finalMerchantPayout,
                        merchantDiscount: merchantDiscount,
                        adminDiscount: adminDiscount,
                        deliveryFee: deliveryFee,
                        returnFee: returnFee,
                        riderTip: tipAmount,
                        waitingCharge: waitingTimeCharge,
                        taxes: (order.finalBilling?.gst || 0) + (order.finalBilling?.serviceGST || 0),
                    },
                    notes: `Customer payment settled for ${isWarehouse ? 'Warehouse ' : ''}order #${order._id.toString().slice(-6).toUpperCase()} (Gross: ₹${totalGrossSales}, Comm 4%: ₹${totalCommission}, Net Merchant: ₹${finalMerchantPayout})`,
                }, session);
            }

            if (order.deliveryFeeRecovery?.required && 
                ['paid_online', 'paid_via_qr', 'paid_cash'].includes(order.deliveryFeeRecovery?.status) && 
                order.deliveryFeeRecovery?.amount > 0) {
                const recoverySource = order.deliveryFeeRecovery.status === 'paid_via_qr' ? 'system_qr' : (order.deliveryFeeRecovery.status === 'paid_cash' ? 'system_cod' : 'system_razorpay');
                const recoveryMethod = order.deliveryFeeRecovery.status === 'paid_via_qr' ? 'upi' : (order.deliveryFeeRecovery.status === 'paid_cash' ? 'cash' : 'razorpay');
                await recordTransaction({
                    amount: order.deliveryFeeRecovery.amount,
                    type: "credit",
                    category: "delivery_fee_recovery",
                    source: recoverySource,
                    status: "completed",
                    paymentMethod: recoveryMethod,
                    referenceNumber: order.deliveryFeeRecovery.razorpayPaymentId || null,
                    recipientType: "user",
                    recipientId: order.userId,
                    recipientDetails: {
                        name: order.deliveryLocation?.name || "",
                        phone: order.deliveryLocation?.phone || "",
                    },
                    orderId: order._id,
                    orderModel: isWarehouse ? "WarehouseOrder" : "Order",
                    warehouseOrderId: isWarehouse ? order._id : null,
                    notes: `Delivery fee recovery collected (${order.deliveryFeeRecovery.status}) for ${isWarehouse ? 'Warehouse ' : ''}order #${order._id.toString().slice(-6).toUpperCase()}`,
                }, session);
            }
        } catch (ledgerErr) {
            console.warn("Could not log order payment to transaction ledger:", ledgerErr.message);
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
