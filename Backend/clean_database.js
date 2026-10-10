import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Pre-Launch Order, Transaction & Payout Sanitization Script
 * 
 * Specifically cleans:
 * 1. Orders (orders, courierorders, warehouseorders, pendingorders, zipcoverorders)
 * 2. Transactions & Ledger (transactions collection)
 * 3. Payout records (dailypayouts, weeklypayouts, riderincentives)
 * 4. Wallets (resets balance to 0 and empties transaction ledger arrays for user, merchant, rider, admin/flashfits)
 * 5. Merchant order earnings & counters (pendingBalance, paidBalance, totalOrders, totalReturns)
 * 6. Rider order states (isBusy: false, currentOrderId: null)
 * 7. Product reservedStock locks (releases any stock locked by cancelled/test orders)
 * 
 * LEAVES UNTOUCHED:
 * - Users, Addresses, Wishlists, Carts, Reviews, Support Tickets, Offers, Notifications, Audit Logs, Products catalog.
 * 
 * Usage:
 *   node clean_database.js --dry-run
 *   node clean_database.js --execute
 */

const isExecute = process.argv.includes('--execute');

async function cleanOrdersAndFinancials() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log(`\n======================================================`);
    console.log(` PRE-LAUNCH CLEANUP: ORDERS, TRANSACTIONS & PAYOUTS`);
    console.log(` Database: ${conn.connection.name} on ${conn.connection.host}`);
    console.log(` Mode: ${isExecute ? '🔴 LIVE EXECUTION' : '🟡 DRY RUN (No changes made)'}`);
    console.log(`======================================================\n`);

    const summary = [];

    async function deleteCollectionDocs(colName) {
      const count = await db.collection(colName).countDocuments();
      if (isExecute && count > 0) {
        await db.collection(colName).deleteMany({});
      }
      summary.push({ target: colName, action: `Delete all ${count} documents`, count, executed: isExecute });
      console.log(`[${colName.toUpperCase()}] ${count} documents ${isExecute ? 'deleted' : 'found to delete'}.`);
    }

    // 1. ORDERS
    console.log('--- 1. ORDERS ---');
    await deleteCollectionDocs('orders');
    await deleteCollectionDocs('courierorders');
    await deleteCollectionDocs('warehouseorders');
    await deleteCollectionDocs('pendingorders');
    await deleteCollectionDocs('zipcoverorders');

    // 2. TRANSACTIONS & LEDGER
    console.log('\n--- 2. TRANSACTIONS & FINANCIAL LEDGER ---');
    await deleteCollectionDocs('transactions');

    // 3. PAYOUT RECORDS (RIDER & MERCHANT)
    console.log('\n--- 3. PAYOUT RECORDS ---');
    await deleteCollectionDocs('dailypayouts');
    await deleteCollectionDocs('weeklypayouts');
    await deleteCollectionDocs('riderincentives');

    // 4. WALLETS (Flashfits, Rider, Merchant, User)
    console.log('\n--- 4. WALLETS ---');
    const walletCount = await db.collection('wallets').countDocuments();
    if (isExecute && walletCount > 0) {
      await db.collection('wallets').updateMany({}, {
        $set: { balance: 0, transactions: [] }
      });
    }
    summary.push({
      target: 'wallets',
      action: `Reset balance to 0 and clear transactions on ${walletCount} wallets (User, Merchant, Rider, Flashfits Admin)`,
      count: walletCount,
      executed: isExecute
    });
    console.log(`[WALLETS] Reset balance=0 and transactions=[] on ${walletCount} wallets.`);

    // 5. MERCHANT EARNINGS & ORDER COUNTERS
    console.log('\n--- 5. MERCHANT STATS & BALANCES ---');
    const merchantCount = await db.collection('merchants').countDocuments();
    if (isExecute && merchantCount > 0) {
      await db.collection('merchants').updateMany({}, {
        $set: {
          "earnings.pendingBalance": 0,
          "earnings.paidBalance": 0,
          "earnings.lastPayoutDate": null,
          "stats.totalOrders": 0,
          "stats.totalReturns": 0
        }
      });
    }
    summary.push({
      target: 'merchants',
      action: `Reset earnings (pending/paid) & order stats to 0 across ${merchantCount} merchants`,
      count: merchantCount,
      executed: isExecute
    });
    console.log(`[MERCHANTS] Reset order earnings & counters across ${merchantCount} merchants.`);

    // 6. RIDER ORDER STATES
    console.log('\n--- 6. DELIVERY RIDERS ORDER STATUS ---');
    const riderCount = await db.collection('deliveryriders').countDocuments();
    if (isExecute && riderCount > 0) {
      await db.collection('deliveryriders').updateMany({}, {
        $set: {
          isBusy: false,
          currentOrderId: null
        }
      });
    }
    summary.push({
      target: 'deliveryriders',
      action: `Reset isBusy: false & currentOrderId: null across ${riderCount} delivery riders`,
      count: riderCount,
      executed: isExecute
    });
    console.log(`[DELIVERYRIDERS] Reset isBusy & currentOrderId across ${riderCount} riders.`);

    // 7. INVENTORY RESERVED STOCK (Unlocks items reserved by test orders)
    console.log('\n--- 7. INVENTORY RESERVED STOCK LOCKS ---');
    const lockedVariants = await db.collection('productflats').countDocuments({ reservedStock: { $gt: 0 } });
    const productFlatsCount = await db.collection('productflats').countDocuments();
    if (isExecute) {
      await db.collection('productflats').updateMany({}, {
        $set: { reservedStock: 0 }
      });
    }
    summary.push({
      target: 'productflats',
      action: `Reset reservedStock=0 (unlocked ${lockedVariants} items reserved by test orders)`,
      count: productFlatsCount,
      executed: isExecute
    });
    console.log(`[PRODUCTFLATS] Released ${lockedVariants} reservedStock locks across variants.`);

    console.log(`\n======================================================`);
    console.log(` SUMMARY OF ACTIONS`);
    console.log(`======================================================`);
    console.table(summary);

    if (isExecute) {
      console.log('\n✅ Orders, Transactions, Ledgers, and Payout records have been completely cleaned!');
    } else {
      console.log('\nℹ️ This was a DRY RUN. Pass --execute to apply changes.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

cleanOrdersAndFinancials();
