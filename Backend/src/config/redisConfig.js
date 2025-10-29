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

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  isUpstash = true;
  upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  console.log("Upstash Redis (REST)");
} else if (process.env.REDIS_URL) {
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", err => console.error("Redis Error:", err));
  client.connect().catch(err => console.error("Connect failed:", err));
  console.log("node-redis (ElastiCache)");
} else {
  throw new Error("Set UPSTASH_... or REDIS_URL");
}

// Unified API – uses typed methods available in both clients
const redis = {
  get: (key) => client.get(key),
  set: (key, value, opts) => client.set(key, value, opts),
  del: (key) => client.del(key),
  setEx: (key, sec, val) => client.set(key, val, { EX: sec }),

  // HSET – typed method with object
  hSet: async (key, data) => {
    try {
      return await client.hset(key, data);
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
        console.log(`Upstash hGetAll response data for key ${key}:`, data);  // Temp debug: check "result"
        const raw = data.result || {};

        // Handle: object (parsed) or fallback array parse
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          console.log(`Upstash hGetAll parsed meta for key ${key}:`, raw);  // Temp; remove after
          return raw;
        } else if (Array.isArray(raw)) {
          const obj = {};
          for (let i = 0; i < raw.length; i += 2) {
            if (raw[i] !== undefined && raw[i + 1] !== undefined) {
              obj[raw[i]] = raw[i + 1];
            }
          }
          console.log(`Upstash hGetAll fallback-parsed meta for key ${key}:`, obj);  // Temp
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
        return await client.hgetall(key);
      } catch (err) {
        console.error(`node-redis hGetAll error for key ${key}:`, err);
        return {};
      }
    }
  },

  // GEOADD – unified object format for single member
  geoAdd: async (key, lng, lat, member) => {
    try {
      const result = await client.geoadd(key, {
        member,
        longitude: lng,
        latitude: lat
      });
      console.log(`${isUpstash ? 'Upstash' : 'node-redis'} geoAdd success for key ${key}, member ${member}`);
      return result;
    } catch (err) {
      console.error(`${isUpstash ? 'Upstash' : 'node-redis'} geoAdd error for key ${key} at (${lat}, ${lng}):`, err);
      return 0;
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
        console.log(`Upstash geoSearch (REST GEORADIUS) raw result for key ${key}:`, parsed.length > 0 ? parsed : '[]');
        return parsed;
      } catch (err) {
        console.error(`Upstash geoSearch (REST) error for key ${key} at (${lat}, ${lng}), radius ${radiusKm}km:`, err);
        return [];
      }
    } else {
      try {
        const raw = await client.georadius(key, lng, lat, radiusKm, 'km', 'WITHDIST', 'ASC', 'COUNT', count);
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
        console.log(`node-redis geoSearch (GEORADIUS) raw result for key ${key}:`, result.length > 0 ? result : '[]');
        return result;
      } catch (err) {
        console.error(`node-redis geoSearch error for key ${key} at (${lat}, ${lng}), radius ${radiusKm}km:`, err);
        return [];
      }
    }
  },

  // Pub/Sub – Upstash fallback to in-memory
  publish: async (ch, msg) => {
    if (typeof client.publish === "function") {
      return client.publish(ch, msg);
    }
    inMemoryPubSub.emit(ch, msg);
    return true;
  },
  subscribe: (ch, fn) => {
    if (typeof client.subscribe === "function") {
      return client.subscribe(ch, fn);
    }
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