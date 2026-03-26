import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { creditWallet } from "./walletHelper.js";
import mongoose from "mongoose";

/**
 * Calculates and distributes funds to merchant, rider, and admin wallets
 * based on the final accepted items in the order.
 * 
 * @param {Object} order The Mongoose order document (fully populated with items.productId not required, we fetch it here)
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

        // We only settle for accepted items
        const acceptedItems = order.items.filter(
            item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
        );

        // 1. Calculate item splits
        for (const item of acceptedItems) {
            const product = await Product.findById(item.productId).select("categoryId subCategoryId").session(session);
            if (!product) continue;

            let commissionPercentage = 0;
            if (product.subCategoryId) {
                // Find the direct category (level-1) to get the commission percentage
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

        // 2. Settlement for Merchant
        if (totalMerchantPayout > 0 && order.merchantId) {
            await creditWallet({
                ownerType: "merchant",
                ownerId: order.merchantId,
                amount: totalMerchantPayout,
                description: `Payout for order ${order._id}`,
                orderId: order._id,
                session
            });
        }

        // 3. Settlement for Admin (Commission)
        if (totalCommission > 0) {
            const Admin = (await import("../models/admin.model.js")).default;
            const firstAdmin = await Admin.findOne({ role: "superadmin" }).session(session);
            if (firstAdmin) {
                await creditWallet({
                    ownerType: "admin",
                    ownerId: firstAdmin._id,
                    amount: totalCommission,
                    description: `Commission for order ${order._id}`,
                    orderId: order._id,
                    session
                });
            }
        }

        // 4. Settlement for Rider
        if (order.deliveryRiderId) {
            const returnedItemsCount = order.items.filter(i => i.tryStatus === "returned").length;
            let riderPayout = order.deliveryCharge || 0;

            if (returnedItemsCount > 0) {
                riderPayout += (order.returnCharge || 0);
            }

            if (riderPayout > 0) {
                await creditWallet({
                    ownerType: "rider",
                    ownerId: order.deliveryRiderId,
                    amount: riderPayout,
                    description: `Delivery payout for order ${order._id}`,
                    orderId: order._id,
                    session
                });
            }
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
        console.error("Order settlement failed:", error);
        
        if (!providedSession) {
            await session.abortTransaction();
            session.endSession();
            
            // Try to mark order as failed (without transaction)
            order.settlementStatus = "failed";
            await order.save().catch(e => console.error("Failed to mark order as failed:", e));
        } else {
            // Throw so parent transaction aborts
            throw error;
        }
        
        return false;
    }
};
