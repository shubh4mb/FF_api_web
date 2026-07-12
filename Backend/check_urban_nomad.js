import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './src/models/merchant.model.js';
import Zone from './src/models/zone.model.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        const merchant = await Merchant.findOne({ shopName: /urban nomad/i });
        if (!merchant) {
            console.log("❌ Urban Nomad merchant not found!");
            return;
        }

        console.log("Before Fix - Merchant isZoneLive:", merchant.isZoneLive);

        if (merchant.zoneId) {
            const zone = await Zone.findById(merchant.zoneId);
            if (zone) {
                console.log("Zone details:", {
                    _id: zone._id,
                    zoneName: zone.zoneName,
                    status: zone.status,
                });
                
                // Update Zone status to Active
                if (zone.status !== 'Active') {
                    zone.status = 'Active';
                    await zone.save();
                    console.log("✅ Updated Zone status to Active");
                }
            }
        }

        // Set isZoneLive to true for the merchant
        merchant.isZoneLive = true;
        await merchant.save();
        console.log("✅ Updated Merchant isZoneLive to true");

        // Clear redis cache to make sure the app sees it immediately
        console.log("Please restart your app or check now.");

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
