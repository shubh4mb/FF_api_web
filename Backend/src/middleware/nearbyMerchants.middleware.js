/**
 * Middleware: Resolve nearby T&B merchants within dynamic radius.
 * Uses Redis geohash-based caching (precision 7 ≈ 150m cells, TTL 15 min).
 *
 * Attaches `req.nearbyMerchantIds` (array of ObjectIds) or null (no filtering).
 */
import mongoose from "mongoose";
import { redis } from "../config/redisConfig.js";
import { filterMerchantsByRoadDistance } from "../helperFns/geoHelpers.js";
import AppConfig from "../models/appConfig.model.js";
import Warehouse from "../models/warehouse.model.js";

const CACHE_TTL_SEC = 15 * 60; // 15 minutes
const GEOHASH_PRECISION = 7;   // ~150m cells

/* ── Lightweight geohash (no external dependency) ── */
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function encodeGeohash(lat, lng, precision = 5) {
  let idx = 0, bit = 0, evenBit = true, hash = "";
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; }
      else { idx = idx * 2; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; }
      else { idx = idx * 2; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

/* ── Middleware ── */
export const resolveNearbyMerchants = async (req, res, next) => {
  try {
    // Read coords from query (GET) or body (POST)
    const lat = parseFloat(req.query.lat || req.body?.lat);
    const lng = parseFloat(req.query.lng || req.body?.lng);

    // No coords → No merchants are "nearby"
    if (isNaN(lat) || isNaN(lng)) {
      req.nearbyMerchantIds = [];
      req.nearbyWarehouseIds = [];
      return next();
    }

    // 1. Fetch configurable radius
    let tryAndBuyRadius = 7;
    try {
      const config = await AppConfig.getConfig();
      if (config?.tryAndBuyRadius) {
        tryAndBuyRadius = config.tryAndBuyRadius;
      }
    } catch (cfgErr) {
      console.warn("[NearbyMerchants] Config read error, using default 7km:", cfgErr.message);
    }

    // 2. Compute geohash cache key
    const geoHash = encodeGeohash(lat, lng, GEOHASH_PRECISION);
    const cacheKey = `tb:merchants:${geoHash}`;

    // 3. Check Redis cache
    let cachedIds = null;
    try {
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached && typeof cached === 'string') {
          cachedIds = JSON.parse(cached);
        }
      }
    } catch (cacheErr) {
      console.warn("[NearbyMerchants] Redis read error (falling back to DB):", cacheErr.message);
    }

    // 4. Cache miss → query DB
    if (!cachedIds) {
      const Merchant = (await import("../models/merchant.model.js")).default;
      const allMerchants = await Merchant.find({
        isActive: true,
        isVerified: true,
        "address.location.coordinates": { $exists: true },
      })
        .select("_id address.location")
        .lean();

      const nearbyMerchants = await filterMerchantsByRoadDistance(
        allMerchants,
        [Number(lng), Number(lat)], // [lng, lat]
        tryAndBuyRadius
      );

      cachedIds = nearbyMerchants.map((m) => m._id.toString());

      // Store in Redis safely
      try {
        if (redis) {
          await redis.set(cacheKey, JSON.stringify(cachedIds), { EX: CACHE_TTL_SEC });
        }
      } catch (writeErr) {
        // Silently ignore cache write errors
      }
    }

    // 5. Convert to ObjectIds and attach
    req.nearbyMerchantIds = (cachedIds || []).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // ── 6. Also resolve nearby warehouses ──
    const whCacheKey = `tb:warehouses:${geoHash}`;
    let cachedWhIds = null;
    try {
      if (redis) {
        const cachedWh = await redis.get(whCacheKey);
        if (cachedWh && typeof cachedWh === 'string') {
          cachedWhIds = JSON.parse(cachedWh);
        }
      }
    } catch (whCacheErr) {
      // Ignore cache error
    }

    if (!cachedWhIds) {
      const allWarehouses = await Warehouse.find({
        isActive: true,
        "address.location.coordinates": { $exists: true },
      })
        .select("_id address.location")
        .lean();

      const nearbyWarehouses = await filterMerchantsByRoadDistance(
        allWarehouses,
        [Number(lng), Number(lat)],
        tryAndBuyRadius
      );

      cachedWhIds = nearbyWarehouses.map((w) => w._id.toString());

      try {
        if (redis) {
          await redis.set(whCacheKey, JSON.stringify(cachedWhIds), { EX: CACHE_TTL_SEC });
        }
      } catch (whWriteErr) {
        // Ignore cache error
      }
    }

    req.nearbyWarehouseIds = (cachedWhIds || []).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    next();
  } catch (err) {
    console.error("[NearbyMiddleware] Middleware error:", err);
    // Robust fallback: direct DB query so customer screen never breaks
    try {
      const lat = parseFloat(req.query.lat || req.body?.lat);
      const lng = parseFloat(req.query.lng || req.body?.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const Merchant = (await import("../models/merchant.model.js")).default;
        const allMerchants = await Merchant.find({
          isActive: true,
          isVerified: true,
          "address.location.coordinates": { $exists: true },
        }).select("_id address.location").lean();
        const nearby = await filterMerchantsByRoadDistance(allMerchants, [lng, lat], 7);
        req.nearbyMerchantIds = nearby.map(m => new mongoose.Types.ObjectId(m._id));
      } else {
        req.nearbyMerchantIds = [];
      }
    } catch (fallbackErr) {
      req.nearbyMerchantIds = [];
    }
    req.nearbyWarehouseIds = req.nearbyWarehouseIds || [];
    next();
  }
};
