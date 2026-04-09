import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Offer = (await import('./src/models/offer.model.js')).default;
        const offers = await Offer.find({ isActive: true }).lean();
        fs.writeFileSync('all_offers.json', JSON.stringify(offers, null, 2));
    } catch(e) {
        fs.writeFileSync('all_offers.json', JSON.stringify({error: e.message}));
    } finally {
        process.exit(0);
    }
})();
