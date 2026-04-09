import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Offer from './src/models/offer.model.js';

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const existing = await Offer.findOne({ type: 'FIRST_TIME_USER', freeDelivery: true });
        if(!existing){
            await Offer.create({
                title: 'Free Delivery on First Order',
                description: 'Get free delivery, return charge, and trial fee waived on your first order.',
                badgeText: 'FREE DELIVERY',
                type: 'FIRST_TIME_USER',
                scope: 'admin',
                discountType: 'percentage',
                discountValue: 0,
                conditions: {
                  firstTimeUserOnly: true
                },
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year validity
                freeDelivery: true,
                isActive: true,
                priority: 100
            });
            console.log('Successfully created the FIRST_TIME_USER free delivery offer.');
        } else {
            console.log('Offer already exists.');
        }
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
