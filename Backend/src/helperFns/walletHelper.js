/**
 * walletHelper.js
 *
 * Universal wallet operations for User, Merchant, Rider, Admin.
 */

import Wallet from "../models/wallet.model.js";

// ── Owner key mapping ──
const OWNER_MAP = {
    user: "userId",
    merchant: "merchantId",
    rider: "deliveryRiderId",
    admin: "adminId",
};

/**
 * Get or create a wallet for any owner type.
 * @param {string} ownerType  - "user" | "merchant" | "rider" | "admin"
 * @param {string} ownerId    - The ObjectId of the owner
 */
export async function getOrCreateWallet(ownerType, ownerId, session = null) {
    const key = OWNER_MAP[ownerType];
    if (!key) throw new Error(`Invalid ownerType: ${ownerType}`);

    // Atomic find or create (upsert)
    const wallet = await Wallet.findOneAndUpdate(
        { [key]: ownerId },
        { 
            $setOnInsert: { 
                ownerType, 
                [key]: ownerId, 
                balance: 0, 
                transactions: [] 
            } 
        },
        { 
            upsert: true, 
            new: true, 
            setDefaultsOnInsert: true, 
            session 
        }
    );

    return wallet;
}

/**
 * Credit an amount to a wallet.
 * Uses atomic $inc and $push to prevent race conditions during high concurrency.
 * @param {object} params
 * @param {string} params.ownerType  - "user" | "merchant" | "rider" | "admin"
 * @param {string} params.ownerId    - ObjectId of the owner
 * @param {number} params.amount
 * @param {string} params.description
 * @param {string} [params.orderId]
 * @param {object} [params.session]
 * @returns {{ wallet, transaction }}
 */
export async function creditWallet({ ownerType, ownerId, amount, description, orderId = null, session = null }) {
    const key = OWNER_MAP[ownerType];
    if (!key) throw new Error(`Invalid ownerType: ${ownerType}`);

    const transaction = {
        type: "credit",
        amount,
        description,
        orderId,
        createdAt: new Date(),
    };

    const wallet = await Wallet.findOneAndUpdate(
        { [key]: ownerId },
        { 
            $inc: { balance: amount },
            $push: { transactions: transaction },
            $setOnInsert: { ownerType, [key]: ownerId }
        },
        { 
            upsert: true, 
            new: true, 
            setDefaultsOnInsert: true, 
            session 
        }
    );

    return { wallet, transaction };
}

/**
 * Debit an amount from a wallet.
 * @throws if insufficient balance (and allowNegative is false)
 */
export async function debitWallet({ ownerType, ownerId, amount, description, orderId = null, session = null, allowNegative = false }) {
    const key = OWNER_MAP[ownerType];
    if (!key) throw new Error(`Invalid ownerType: ${ownerType}`);

    const transaction = {
        type: "debit",
        amount,
        description,
        orderId,
        createdAt: new Date(),
    };

    if (allowNegative) {
        // If negative balances are allowed, we can use upsert just like creditWallet
        const wallet = await Wallet.findOneAndUpdate(
            { [key]: ownerId },
            { 
                $inc: { balance: -amount },
                $push: { transactions: transaction },
                $setOnInsert: { ownerType, [key]: ownerId }
            },
            { 
                upsert: true, 
                new: true, 
                setDefaultsOnInsert: true, 
                session 
            }
        );
        return { wallet, transaction };
    }

    // If negative is not allowed, we MUST ensure the wallet exists first 
    // before doing a strict $gte check, otherwise upsert with $gte causes issues.
    await getOrCreateWallet(ownerType, ownerId, session);

    const wallet = await Wallet.findOneAndUpdate(
        { [key]: ownerId, balance: { $gte: amount } },
        { 
            $inc: { balance: -amount },
            $push: { transactions: transaction }
        },
        { new: true, session }
    );

    if (!wallet) {
        throw new Error(`Insufficient wallet balance for ${ownerType}. Required: ₹${amount}`);
    }

    return { wallet, transaction };
}

/**
 * Get wallet balance and recent transactions.
 * @param {string} ownerType
 * @param {string} ownerId
 */
export async function getWalletDetails(ownerType, ownerId) {
    const wallet = await getOrCreateWallet(ownerType, ownerId);
    return {
        balance: wallet.balance,
        transactions: wallet.transactions.slice(-20).reverse(),
    };
}
