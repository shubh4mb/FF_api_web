import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Zone from './Backend/src/models/zone.model.js';
import Merchant from './Backend/src/models/merchant.model.js';

dotenv.config({ path: './Backend/.env' });

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Update all zones without a status to 'Active' 
        // (Assuming existing zones should stay functional)
        const zoneResult = await Zone.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'Active' } }
        );
        console.log(`Updated ${zoneResult.modifiedCount} zones to 'Active'`);

        // 2. Fetch all zones to sync merchants
        const zones = await Zone.find({}).lean();
        
        for (const zone of zones) {
            const isLive = zone.status === 'Active';
            const merchantResult = await Merchant.updateMany(
                { zoneId: zone._id },
                { $set: { isZoneLive: isLive } }
            );
            console.log(`Synced isZoneLive=${isLive} for ${merchantResult.modifiedCount} merchants in zone: ${zone.zoneName}`);
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
