import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Zone from './src/models/zone.model.js';

dotenv.config();

const find = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const zones = await Zone.find({}).select('zoneName status').lean();
        console.log(JSON.stringify(zones, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};
find();
