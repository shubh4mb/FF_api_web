import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { redis } from './src/config/redisConfig.js';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB & Redis");

    const db = mongoose.connection.db;
    const pendingOrders = await db.collection('pendingorders').find({ status: 'queued' }).toArray();
    console.log("--- PENDING ORDERS ---");
    console.log(`Found ${pendingOrders.length} queued orders.`);
    pendingOrders.forEach(o => console.log(`[Order ${o.orderId}] Zone: ${o.zoneName}`));

    console.log("\n--- REDIS RIDER META ---");
    const metaKeys = await redis.keys("rider:*:meta");
    for (const key of metaKeys) {
        const meta = await redis.hGetAll(key);
        console.log(`[Rider ${key.split(":")[1]}] Zone: ${meta.zoneId}, isOnline: ${meta.isOnline}, isBusy: ${meta.isBusy}, lastSeen: ${new Date(parseInt(meta.lastSeenAt)).toISOString()}`);
    }

    mongoose.disconnect();
    redis.quit();
  })
  .catch(err => console.error("Error:", err));
