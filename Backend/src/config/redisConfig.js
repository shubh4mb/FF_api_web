// src/config/redisConfig.js
import { createClient } from "redis";
import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
import { EventEmitter } from "events";

dotenv.config();

// In-memory fallback for Pub/Sub (Upstash doesn't support real-time Pub/Sub)
const inMemoryPubSub = new EventEmitter();
const inMemoryIndex = {
  _set: new Set(),
  add(key) { this._set.add(key); },
  delete(key) { this._set.delete(key); },
  keys(pattern) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return Array.from(this._set).filter(k => regex.test(k));
  },
};

// Choose client
let client;
let isUpstash = false;  // For logging only
let upstashUrl;  // For REST fallback
let upstashToken;  // For auth

const preferLocal = process.env.USE_LOCAL_REDIS === 'true' || (!process.env.UPSTASH_REDIS_REST_URL && process.env.REDIS_URL);

if (preferLocal && process.env.REDIS_URL) {
  let redisUrl = process.env.REDIS_URL;

  // On Windows local development, automatically route to WSL Redis IP if needed
  if (process.platform === 'win32' && (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost'))) {
    try {
      const { execSync } = await import('child_process');
      const wslIp = execSync('wsl hostname -I', { timeout: 2000 }).toString().trim().split(' ')[0];
      if (wslIp && wslIp.startsWith('172.')) {
        redisUrl = `redis://${wslIp}:6379`;
      }
    } catch {
      // Fallback to original URL
    }
  }

  client = createClient({ url: redisUrl });
  client.on("error", err => console.error("Redis Error:", err.message));
  client.connect()
    .then(() => console.log(`🚀 Native Redis Connected: ${redisUrl}`))
    .catch(err => console.error("❌ Native Redis Connect failed:", err.message));
} else if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  isUpstash = true;
  upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  console.log("☁️ Upstash Redis (REST)");
} else {
  throw new Error("Set UPSTASH_... or REDIS_URL");
}

// Unified API – uses typed methods available in both clients
const redis = {
  get: (key) => client.get(key),
  set: (key, value, opts) => client.set(key, value, opts),
  del: (key) => client.del(key),
  setEx: (key, sec, val) => client.set(key, val, { EX: sec }),

  // HSET – typed method with object (handles node-redis v5 and Upstash)
  hSet: async (key, data) => {
    try {
      return await (client.hSet ? client.hSet(key, data) : client.hset(key, data));
    } catch (err) {
      console.error(`${isUpstash ? 'Upstash' : 'node-redis'} hSet error for key ${key}:`, err);
      return 0;
    }
  },

  // HGETALL – branched: typed for node-redis, path-style GET for Upstash (clean object response)
  hGetAll: async (key) => {
    if (isUpstash) {
      // Upstash: Path-style GET /hgetall/key (returns parsed { field: value } object)
      try {
        const encodedKey = encodeURIComponent(key);
        const response = await fetch(`${upstashUrl}/hgetall/${encodedKey}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${upstashToken}`
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const data = await response.json();
        // console.log(`Upstash hGetAll response data for key ${key}:`, data);  // Temp debug: check "result"
        const raw = data.result || {};

        // Handle: object (parsed) or fallback array parse
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          // console.log(`Upstash hGetAll parsed meta for key ${key}:`, raw);  // Temp; remove after
          return raw;
        } else if (Array.isArray(raw)) {
          const obj = {};
          for (let i = 0; i < raw.length; i += 2) {
            if (raw[i] !== undefined && raw[i + 1] !== undefined) {
              obj[raw[i]] = raw[i + 1];
            }
          }
          // console.log(`Upstash hGetAll fallback-parsed meta for key ${key}:`, obj);  // Temp
          return obj;
        } else {
          console.error(`Upstash hGetAll unexpected raw for key ${key}:`, raw);
          return {};
        }
      } catch (err) {
        console.error(`Upstash hGetAll (path-style) error for key ${key}:`, err);
        return {};
      }
    } else {
      // node-redis: typed HGETALL (returns object)
      try {
        return await (client.hGetAll ? client.hGetAll(key) : client.hgetall(key));
      } catch (err) {
        console.error(`node-redis hGetAll error for key ${key}:`, err);
        return {};
      }
    }
  },

  // GEOADD – unified object format for single member
  geoAdd: async (key, lng, lat, member) => {
    try {
      const result = await (client.geoAdd
        ? client.geoAdd(key, { member, longitude: lng, latitude: lat })
        : client.geoadd(key, { member, longitude: lng, latitude: lat }));
      return result;
    } catch (err) {
      console.error(`${isUpstash ? 'Upstash' : 'node-redis'} geoAdd error for key ${key} at (${lat}, ${lng}):`, err);
      return 0;
    }
  },

  // GEOPOS – returns coordinates for one or more members [{ longitude, latitude }, ...]
  geoPos: async (key, ...members) => {
    const flatMembers = members.flat();
    if (isUpstash) {
      try {
        const raw = await client.geopos(key, ...flatMembers);
        if (!Array.isArray(raw)) return [];
        return raw.map((item) => {
          if (!item) return null;
          if (Array.isArray(item)) {
            return { longitude: item[0], latitude: item[1] };
          }
          return {
            longitude: item.longitude ?? item.lng,
            latitude: item.latitude ?? item.lat,
          };
        });
      } catch (err) {
        console.error(`Upstash geoPos error for key ${key}:`, err);
        return [];
      }
    } else {
      try {
        const raw = await client.geoPos(key, flatMembers.length === 1 ? flatMembers[0] : flatMembers);
        if (!Array.isArray(raw)) return [];
        return raw.map((item) => {
          if (!item) return null;
          return { longitude: item.longitude, latitude: item.latitude };
        });
      } catch (err) {
        console.error(`node-redis geoPos error for key ${key}:`, err);
        return [];
      }
    }
  },

  // GEOSEARCH – unchanged (POST JSON works for GEORADIUS)
  geoSearch: async (key, lng, lat, radiusKm, count = 10) => {
    if (isUpstash) {
      try {
        const commandArgs = [
          "GEORADIUS",
          key,
          lng.toString(),
          lat.toString(),
          radiusKm.toString(),
          "km",
          "WITHDIST",
          "ASC",
          "COUNT",
          count.toString()
        ];
        const response = await fetch(`${upstashUrl}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${upstashToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(commandArgs)
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const { result, error } = await response.json();
        if (error) {
          throw new Error(error);
        }
        const raw = result || [];

        const parsed = [];
        if (Array.isArray(raw) && raw.length > 0) {
          for (const item of raw) {
            if (Array.isArray(item) && item.length >= 2 && item[0] && item[1]) {
              parsed.push({
                member: item[0],
                dist: parseFloat(item[1])
              });
            }
          }
        }
        // console.log(`Upstash geoSearch (REST GEORADIUS) raw result for key ${key}:`, parsed.length > 0 ? parsed : '[]');
        return parsed;
      } catch (err) {
        console.error(`Upstash geoSearch (REST) error for key ${key} at (${lat}, ${lng}), radius ${radiusKm}km:`, err);
        return [];
      }
    } else {
      try {
        const raw = client.sendCommand
          ? await client.sendCommand(['GEORADIUS', key, lng.toString(), lat.toString(), radiusKm.toString(), 'km', 'WITHDIST', 'ASC', 'COUNT', count.toString()])
          : await client.georadius(key, lng, lat, radiusKm, 'km', 'WITHDIST', 'ASC', 'COUNT', count);
        const result = [];
        if (Array.isArray(raw) && raw.length > 0) {
          for (const item of raw) {
            if (Array.isArray(item) && item.length >= 2 && item[0] && item[1]) {
              result.push({
                member: item[0],
                dist: parseFloat(item[1])
              });
            }
          }
        }
        // console.log(`node-redis geoSearch (GEORADIUS) raw result for key ${key}:`, result.length > 0 ? result : '[]');
        return result;
      } catch (err) {
        console.error(`node-redis geoSearch error for key ${key} at (${lat}, ${lng}), radius ${radiusKm}km:`, err);
        return [];
      }
    }
  },

  // Pub/Sub – in-memory event bus prevents locking main Redis client into subscriber mode
  publish: async (ch, msg) => {
    inMemoryPubSub.emit(ch, msg);
    return true;
  },
  subscribe: (ch, fn) => {
    inMemoryPubSub.on(ch, fn);
  },

  // KEYS
  keys: async (pat) => {
    if (typeof client.keys === "function") {
      return client.keys(pat);
    }
    return inMemoryIndex.keys(pat);
  },
};

export { redis, inMemoryIndex, inMemoryPubSub };