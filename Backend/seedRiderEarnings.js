import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import DeliveryRider from './src/models/deliveryRider.model.js';
import WeeklyPayout from './src/models/weeklyPayout.model.js';
import DailyPayout from './src/models/dailyPayout.model.js';
import Order from './src/models/order.model.js';
import { getCurrentWeekBounds } from './src/helperFns/weeklyPayoutHelper.js';

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB.");

        const rider = await DeliveryRider.findOne();
        if (!rider) {
            console.log("No rider found.");
            process.exit(0);
        }

        console.log(`Seeding data for rider: ${rider.phone} (${rider._id})`);

        // Clear existing payouts for this rider to avoid conflicts
        await WeeklyPayout.deleteMany({ ownerId: rider._id, ownerType: "rider" });
        await DailyPayout.deleteMany({ riderId: rider._id });

        // Generate past 4 weeks
        for (let i = 1; i <= 4; i++) {
            // Get date i weeks ago
            const d = new Date();
            d.setDate(d.getDate() - (i * 7));
            const { weekStart, weekEnd } = getCurrentWeekBounds(d);
            
            console.log(`Generating past week ${i}: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
            
            const orders = [];
            let totalAmount = 0;
            const completedOrders = Math.floor(Math.random() * 20) + 10;
            
            for (let j = 0; j < completedOrders; j++) {
                const amount = Math.floor(Math.random() * 50) + 20; // 20 to 70 rs
                totalAmount += amount;
                
                // random date within the week
                const orderDate = new Date(weekStart.getTime() + Math.random() * (weekEnd.getTime() - weekStart.getTime()));
                
                orders.push({
                    orderId: new mongoose.Types.ObjectId(),
                    amount: amount,
                    type: "credit",
                    description: `Delivery for Order #${Math.floor(Math.random() * 90000) + 10000}`,
                    settledAt: orderDate
                });
            }

            const incentiveAmount = Math.random() > 0.5 ? 150 : 0;
            const finalAmount = totalAmount + incentiveAmount;
            
            await WeeklyPayout.create({
                ownerType: "rider",
                ownerId: rider._id,
                weekStart,
                weekEnd,
                status: "paid",
                totalEarnings: totalAmount,
                totalDeductions: 0,
                netPayout: totalAmount,
                completedOrders,
                cancelledOrders: Math.floor(Math.random() * 2),
                totalIncentive: incentiveAmount,
                finalAmount: finalAmount,
                orders,
                paidAt: new Date(weekEnd.getTime() + 86400000) // paid 1 day after week ends
            });
        }

        // Current week
        const { weekStart, weekEnd } = getCurrentWeekBounds(new Date());
        console.log(`Generating current week: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
        
        let currentWeekOrders = [];
        let currentWeekEarnings = 0;
        let currentCompletedOrders = 0;

        // Create some DailyPayouts for current week
        for (let j = 0; j <= new Date().getDay(); j++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(dayDate.getDate() + j);
            
            const numOrders = Math.floor(Math.random() * 5) + 1;
            let dailyTotal = 0;
            
            for(let k = 0; k < numOrders; k++) {
                const amount = Math.floor(Math.random() * 50) + 20;
                dailyTotal += amount;
                
                currentWeekOrders.push({
                    orderId: new mongoose.Types.ObjectId(),
                    amount: amount,
                    type: "credit",
                    description: `Delivery for Order #${Math.floor(Math.random() * 90000) + 10000}`,
                    settledAt: new Date(dayDate.getTime() + Math.random() * 86400000)
                });
            }
            
            await DailyPayout.create({
                riderId: rider._id,
                date: dayDate,
                completedOrders: numOrders,
                cancelledOrders: 0,
                totalEarnings: dailyTotal,
                loginHours: Math.floor(Math.random() * 8) + 2
            });
            
            currentCompletedOrders += numOrders;
            currentWeekEarnings += dailyTotal;
        }

        await WeeklyPayout.create({
            ownerType: "rider",
            ownerId: rider._id,
            weekStart,
            weekEnd,
            status: "accumulating",
            totalEarnings: currentWeekEarnings,
            totalDeductions: 0,
            netPayout: currentWeekEarnings,
            completedOrders: currentCompletedOrders,
            cancelledOrders: 0,
            totalIncentive: 0,
            finalAmount: currentWeekEarnings,
            orders: currentWeekOrders
        });

        console.log("Successfully seeded dummy data!");
        process.exit(0);

    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
