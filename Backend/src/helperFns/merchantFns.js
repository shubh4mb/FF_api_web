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
    console.log(`[Redis] Reading meta for merchant:${merchantId}:meta`);
    const rawMeta = await redis.hGetAll(`merchant:${merchantId}:meta`);
    console.log(`[Redis] Raw meta for merchant:${merchantId}:meta result:`, rawMeta);
    const meta = { ...rawMeta };
    if (meta.isOnline !== undefined) meta.isOnline = meta.isOnline === 'true';
    if (meta.lastSeenAt !== undefined) meta.lastSeenAt = parseInt(meta.lastSeenAt, 10) || Date.now();
    return meta;
}
