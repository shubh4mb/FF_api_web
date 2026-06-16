import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './src/models/merchant.model.js';

dotenv.config();

const find = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const merchants = await Merchant.find({ isActive: true }).select('shopName isOnline isZoneLive zoneId').lean();
        console.log(JSON.stringify(merchants, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};
find();
