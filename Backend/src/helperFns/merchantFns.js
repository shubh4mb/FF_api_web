// src/helperFns/merchantFns.js
import { redis, inMemoryIndex } from "../config/redisConfig.js";

// Set Merchant Meta
export async function setMerchantMeta(merchantId, obj) {
    const flat = { ...obj };
    for (const k in flat) {
        flat[k] = String(flat[k]);
    }
    if (Object.keys(flat).length) {
        await redis.hSet(`merchant:${merchantId}:meta`, flat);
        inMemoryIndex.add(`merchant:${merchantId}:meta`);
    }
}

export async function getMerchantMeta(merchantId) {
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 400)
        );
        const rawMeta = await Promise.race([
            redis.hGetAll(`merchant:${merchantId}:meta`),
            timeoutPromise
        ]);
        const meta = { ...rawMeta };
        if (meta.isOnline !== undefined) meta.isOnline = meta.isOnline === 'true';
        if (meta.lastSeenAt !== undefined) meta.lastSeenAt = parseInt(meta.lastSeenAt, 10) || Date.now();
        return meta;
    } catch (err) {
        return {};
    }
}
