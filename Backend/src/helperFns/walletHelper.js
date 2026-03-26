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

    let wallet = await Wallet.findOne({ [key]: ownerId }).session(session);
    if (!wallet) {
        const walletObj = {
            ownerType,
            [key]: ownerId,
            balance: 0,
            transactions: [],
        };
        if (session) {
            wallet = await Wallet.create([walletObj], { session });
            wallet = wallet[0];
        } else {
            wallet = await Wallet.create(walletObj);
        }
    }
    return wallet;
}

/**
 * Credit an amount to a wallet.
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
    let wallet = await getOrCreateWallet(ownerType, ownerId, session);

    const transaction = {
        type: "credit",
        amount,
        description,
        orderId,
        createdAt: new Date(),
    };

    wallet.balance += amount;
    wallet.transactions.push(transaction);
    await wallet.save({ session });

    return { wallet, transaction };
}

/**
 * Debit an amount from a wallet.
 * @throws if insufficient balance
 */
export async function debitWallet({ ownerType, ownerId, amount, description, orderId = null, session = null }) {
    let wallet = await getOrCreateWallet(ownerType, ownerId, session);

    if (wallet.balance < amount) {
        throw new Error(`Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${amount}`);
    }

    const transaction = {
        type: "debit",
        amount,
        description,
        orderId,
        createdAt: new Date(),
    };

    wallet.balance -= amount;
    wallet.transactions.push(transaction);
    await wallet.save({ session });

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
