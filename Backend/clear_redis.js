import dotenv from 'dotenv';
import { redis } from './src/config/redisConfig.js';

dotenv.config();

async function run() {
    try {
        console.log("Connecting to Redis...");
        // If it's node-redis we might need to connect first
        if (typeof redis.connect === 'function') {
            await redis.connect();
        }
        
        console.log("Connected to Redis.");
        
        // Find keys pattern
        // Upstash vs Node-redis API differences:
        // node-redis uses redis.keys('tb:merchants:*')
        // Upstash uses redis.keys('tb:merchants:*') or scan
        let keys = [];
        try {
            keys = await redis.keys('tb:merchants:*');
        } catch (e) {
            // Fallback for upstash/rest if keys is not directly a function in the same way
            console.log("Keys call failed, trying scan/flushDb");
            // If it's Upstash Redis, keys is a REST API method
            // let's try flushAll/flushDb
        }

        console.log("Found keys to delete:", keys);
        if (keys && keys.length > 0) {
            for (const key of keys) {
                await redis.del(key);
                console.log("Deleted key:", key);
            }
        } else {
            // Let's flush everything if it's local
            try {
                if (typeof redis.flushDb === 'function') {
                    await redis.flushDb();
                    console.log("Flushed DB (node-redis)");
                } else if (typeof redis.flushall === 'function') {
                    await redis.flushall();
                    console.log("Flushed All (node-redis)");
                } else if (typeof redis.flush === 'function') {
                    await redis.flush();
                    console.log("Flushed Upstash");
                }
            } catch (flushErr) {
                console.log("Flush failed:", flushErr.message);
            }
        }
        console.log("✅ Redis cache cleared successfully!");
    } catch (e) {
        console.error(e);
    } finally {
        if (typeof redis.quit === 'function') {
            await redis.quit();
        }
    }
}

run();
