/**
 * walletHelper.js
 *
 * Handles wallet operations: credit, debit, refund on merchant decline.
 */

import Wallet from "../models/wallet.model.js";

/**
 * Get or create a wallet for a user.
 */
export async function getOrCreateWallet(userId) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }
    return wallet;
}

/**
 * Credit an amount to the user's wallet.
 * @returns {object} { wallet, transaction }
 */
export async function creditWallet({ userId, amount, description, orderId = null }) {
    const wallet = await getOrCreateWallet(userId);

    const transaction = {
        type: "credit",
        amount,
        description,
        orderId,
        createdAt: new Date(),
    };

    wallet.balance += amount;
    wallet.transactions.push(transaction);
    await wallet.save();

    return { wallet, transaction };
}

/**
 * Debit an amount from the user's wallet.
 * @returns {object} { wallet, transaction } or throws if insufficient balance
 */
export async function debitWallet({ userId, amount, description, orderId = null }) {
    const wallet = await getOrCreateWallet(userId);

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
    await wallet.save();

    return { wallet, transaction };
}

/**
 * Get wallet balance and recent transactions.
 */
export async function getWalletDetails(userId) {
    const wallet = await getOrCreateWallet(userId);
    return {
        balance: wallet.balance,
        transactions: wallet.transactions.slice(-20).reverse(), // last 20, newest first
    };
}
