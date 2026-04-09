import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { findBestOffers } from './src/services/offerEngine.js';
import User from './src/models/user.model.js';
import Offer from './src/models/offer.model.js';

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const offersDb = await Offer.find({ isActive: true }).lean();
        console.log('ACTIVE OFFERS IN DB:', JSON.stringify(offersDb, null, 2));

        const user = await User.findOne({});
        if(!user) {
            console.log('No user found to test with.');
            process.exit(0);
        }

        const offers = await findBestOffers(user._id.toString(), { 
            items: [{ price: 1000, quantity: 1, merchantId: '65e99f4d1e2a5c4e9d0a1b2c' }], 
            subtotal: 1000, 
            merchantTotals: {'65e99f4d1e2a5c4e9d0a1b2c': 1000} 
        });
        console.log('\n\nFIND BEST OFFERS RESULT:');
        console.log(JSON.stringify(offers, null, 2));
    } catch(err) {
        console.error('ERROR:', err);
    } finally {
        process.exit();
    }
})();
