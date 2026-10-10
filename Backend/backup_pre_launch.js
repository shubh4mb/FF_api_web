import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const BACKUP_DIR = path.resolve('db_backup_prelaunch_20261010');

async function backupCollections() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const collectionsToBackup = [
      'orders',
      'courierorders',
      'warehouseorders',
      'transactions',
      'dailypayouts',
      'weeklypayouts',
      'wallets',
      'reviews',
      'supporttickets',
      'offerusages',
      'notifications',
      'auditlogs',
      'carts',
      'couriercarts',
      'recentlyvieweds',
      'onlinesessions',
      'wishlists',
      'merchants',
      'deliveryriders',
      'productflats',
      'products'
    ];

    console.log(`Starting backup of ${collectionsToBackup.length} collections to ${BACKUP_DIR}...`);

    for (const colName of collectionsToBackup) {
      try {
        const docs = await db.collection(colName).find({}).toArray();
        const filePath = path.join(BACKUP_DIR, `${colName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
        console.log(`  ✓ Backed up ${colName}: ${docs.length} documents -> ${filePath}`);
      } catch (err) {
        console.warn(`  ✗ Failed to backup ${colName}:`, err.message);
      }
    }

    console.log('\n✅ All targeted collections successfully backed up!');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Backup error:', err);
    process.exit(1);
  }
}

backupCollections();
