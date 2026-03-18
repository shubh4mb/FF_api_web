import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { creditWallet } from "./walletHelper.js";

/**
 * Calculates and distributes funds to merchant, rider, and admin wallets
 * based on the final accepted items in the order.
 * 
 * @param {Object} order The Mongoose order document (fully populated with items.productId not required, we fetch it here)
 */
export const settleOrder = async (order) => {
    try {
        let totalCommission = 0;
        let totalMerchantPayout = 0;

        // We only settle for accepted items
        const acceptedItems = order.items.filter(
            item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
        );

        // 1. Calculate item splits
        for (const item of acceptedItems) {
            const product = await Product.findById(item.productId).select("categoryId");
            if (!product) continue;

            let commissionPercentage = 0;
            if (product.categoryId) {
                // Find the direct category (level-2) to get the commission percentage
                const category = await Category.findById(product.categoryId).select("commissionPercentage");
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
                orderId: order._id
            });
        }

        // 3. Settlement for Admin (Commission)
        // We assume Admin wallet ownerId is a fixed string or we look up a superadmin. 
        // For now, we use a generic "admin" pool with a static virtual ID, or just omit the ownerId 
        // query by looking for the first admin. Let's find the first superadmin.
        if (totalCommission > 0) {
            const Admin = (await import("../models/admin.model.js")).default;
            const firstAdmin = await Admin.findOne({ role: "superadmin" });
            if (firstAdmin) {
                await creditWallet({
                    ownerType: "admin",
                    ownerId: firstAdmin._id,
                    amount: totalCommission,
                    description: `Commission for order ${order._id}`,
                    orderId: order._id
                });
            }
        }

        // 4. Settlement for Rider
        // Rider gets: Delivery Charge + (Return Charge if applicable)
        // If all items kept, the customer got a discount for the return charge, meaning no return trip.
        // So rider only gets deliveryCharge.
        // If there ARE returned items, rider had to make the return trip, so rider gets delivery+return charge.
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
                    orderId: order._id
                });
            }
        }

        return true;
    } catch (error) {
        console.error("Order settlement failed:", error);
        // Depending on strictness, we might throw or return false
        // throw error; 
        return false;
    }
};
