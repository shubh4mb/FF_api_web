import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

import { findBestOffers } from './src/services/offerEngine.js';

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const offers = await findBestOffers('65e99f4d1e2a5c4e9d0a1b2c', { 
            items: [{ price: 1000, quantity: 1, merchantId: '65e99f4d1e2a5c4e9d0a1b2c' }], 
            subtotal: 1000, 
            merchantTotals: {'65e99f4d1e2a5c4e9d0a1b2c': 1000} 
        });
        fs.writeFileSync('testOffers_output.json', JSON.stringify(offers, null, 2));
    } catch(err) {
        fs.writeFileSync('testOffers_output.json', JSON.stringify({ error: err.message, stack: err.stack }));
    } finally {
        process.exit();
    }
})();
