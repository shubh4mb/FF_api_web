/**
 * Middleware: Resolve nearby T&B merchants within 7km.
 * Uses Redis geohash-based caching (precision 5 ≈ 4.9km cells, TTL 15 min).
 *
 * Attaches `req.nearbyMerchantIds` (array of ObjectIds) or null (no filtering).
 */
import mongoose from "mongoose";
import { redis } from "../config/redisConfig.js";
import { filterMerchantsByDistance } from "../helperFns/geoHelpers.js";
import AppConfig from "../models/appConfig.model.js";

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
      return next();
    }

    // 1. Fetch configurable radius
    const config = await AppConfig.getConfig();
    const tryAndBuyRadius = config.tryAndBuyRadius || 7;

    // 2. Compute geohash cache key
    const geoHash = encodeGeohash(lat, lng, 6);
    const cacheKey = `tb:merchants:${geoHash}`;

    // 2. Check Redis cache
    let cachedIds = null;
    try {
      const cached = await redis.get(cacheKey);
      if (cached && typeof cached === 'string') {
        cachedIds = JSON.parse(cached);
        console.log(`[NearbyMerchants] Cache HIT for ${geoHash} — ${cachedIds.length} merchants`);
      }
    } catch (cacheErr) {
      console.error("[NearbyMerchants] Redis read error:", cacheErr);
      // If cache is corrupted, delete it
      await redis.del(cacheKey).catch(() => {});
    }

    // 3. Cache miss → query DB
    if (!cachedIds) {
      const Merchant = (await import("../models/merchant.model.js")).default;
      const allMerchants = await Merchant.find({
        isActive: true,
        isVerified: true,
        "address.location.coordinates": { $exists: true },
      })
        .select("_id address.location")
        .lean();

      const nearbyMerchants = filterMerchantsByDistance(
        allMerchants,
        [Number(lng), Number(lat)], // [lng, lat]
        tryAndBuyRadius
      );

      cachedIds = nearbyMerchants.map((m) => m._id.toString());
      console.log(`[NearbyMerchants] Cache MISS for ${geoHash} — found ${cachedIds.length} merchants in ${tryAndBuyRadius}km`);

      // 4. Store in Redis
      try {
        await redis.set(cacheKey, JSON.stringify(cachedIds), { EX: CACHE_TTL_SEC });
      } catch (writeErr) {
        console.error("[NearbyMerchants] Redis write error:", writeErr);
      }
    }

    // 5. Convert to ObjectIds and attach
    req.nearbyMerchantIds = cachedIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    next();
  } catch (err) {
    console.error("[NearbyMerchants] Middleware error:", err);
    // Don't block the request — fall through without filtering
    req.nearbyMerchantIds = null;
    next();
  }
};
