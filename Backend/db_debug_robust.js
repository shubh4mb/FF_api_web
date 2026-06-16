import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    let output = '';
    const log = (...args) => {
        output += args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ') + '\n';
        console.log(...args);
    };

    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Offer = (await import('./src/models/offer.model.js')).default;
        
        const offersDb = await Offer.find({ isActive: true }).lean();
        log('ACTIVE OFFERS DB:', offersDb);

        const User = (await import('./src/models/user.model.js')).default;
        const user = await User.findOne({});
        const userId = user ? user._id.toString() : null;

        if (userId) {
            const { findBestOffers } = await import('./src/services/offerEngine.js');
            const cartContext = { 
                items: [{ price: 1000, quantity: 1, merchantId: '6620f4c0a5b1c55c0aef8e4a' }], 
                subtotal: 1000, 
                merchantTotals: {'6620f4c0a5b1c55c0aef8e4a': 1000} 
            };
            const result = await findBestOffers(userId, cartContext);
            log('\nFIND BEST OFFERS RESULT:', result);
        }
    } catch(e) {
        log('ERROR:', { message: e.message, stack: e.stack });
    } finally {
        fs.writeFileSync('db_debug_result.txt', output);
        process.exit(0);
    }
})();
