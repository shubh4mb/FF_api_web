// src/config/redisClient.js
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL is not defined in .env");
}

// Publisher and subscriber for Redis adapter
export const redisPub = createClient({ url: REDIS_URL });
export const redisSub = redisPub.duplicate();

// Connect Redis
await redisPub.connect();
await redisSub.connect();

console.log("✅ Redis connected");
