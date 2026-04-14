import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from Backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
}

const fixWallets = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        const db = mongoose.connection.db;
        const collection = db.collection('wallets');

        console.log('🔍 Finding wallets with null owner fields...');
        
        // Find documents where any of these fields are null
        const filter = {
            $or: [
                { userId: null },
                { merchantId: null },
                { deliveryRiderId: null },
                { adminId: null }
            ]
        };

        const count = await collection.countDocuments(filter);
        console.log(`📊 Found ${count} documents requiring cleanup.`);

        if (count > 0) {
            console.log('🛠 Unsetting null fields...');
            const result = await collection.updateMany(
                filter,
                {
                    $unset: {
                        userId: "",
                        merchantId: "",
                        deliveryRiderId: "",
                        adminId: ""
                    }
                }
            );
            console.log(`✅ Successfully updated ${result.modifiedCount} documents.`);
        } else {
            console.log('✅ No documents needed cleanup.');
        }

        console.log('🏁 Wallet index fix completed.');
        process.exit(0);
    } catch (error) {
        console.error(`❌ Migration Error: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
};

fixWallets();
