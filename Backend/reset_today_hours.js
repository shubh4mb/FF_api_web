import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import DailyPayout from './src/models/dailyPayout.model.js';
import { getDayStartIST } from './src/helperFns/weeklyPayoutHelper.js';

async function reset() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const today = getDayStartIST();
        console.log("Resetting loginHours for date:", today);
        
        const result = await DailyPayout.updateMany(
            { date: today },
            { $set: { loginHours: 0 } }
        );
        
        console.log("Updated", result.modifiedCount, "records.");
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

reset();
