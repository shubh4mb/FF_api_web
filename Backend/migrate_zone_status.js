import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Zone from './src/models/zone.model.js';
import Merchant from './src/models/merchant.model.js';

console.log('Starting migration script...');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
}

console.log(`Connecting to: ${MONGODB_URI.split('@').pop()}`); // Log host for safety

const migrate = async () => {
    try {
        const conn = await mongoose.connect(MONGODB_URI);
        console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);

        // 1. Update all zones without a status to 'Active' 
        const zoneResult = await Zone.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'Active' } }
        );
        console.log(`✅ Updated ${zoneResult.modifiedCount} zones to 'Active'`);

        // 2. Fetch all zones to sync merchants
        const zones = await Zone.find({}).lean();
        console.log(`Found ${zones.length} zones to process.`);
        
        for (const zone of zones) {
            const isLive = zone.status === 'Active';
            const merchantResult = await Merchant.updateMany(
                { zoneId: zone._id },
                { $set: { isZoneLive: isLive } }
            );
            console.log(`   - Synced isZoneLive=${isLive} for ${merchantResult.modifiedCount} merchants in zone: ${zone.zoneName || zone._id}`);
        }

        console.log('🎉 Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrate();
