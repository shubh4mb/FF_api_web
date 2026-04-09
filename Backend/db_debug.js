import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Offer = (await import('./src/models/offer.model.js')).default;
        
        const offersDb = await Offer.find({ isActive: true }).lean();
        console.log('ACTIVE OFFERS DB:', JSON.stringify(offersDb, null, 2));

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
            console.log('\n\nFIND BEST OFFERS RESULT:', JSON.stringify(result, null, 2));
        }
    } catch(e) {
        console.error('ERROR:', e);
    } finally {
        process.exit(0);
    }
})();
