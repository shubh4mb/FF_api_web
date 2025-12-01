// src/utils/zoneInfer.js
import Zone from '../models/zone.model.js';

const CACHE = new Map(); // Simple in-memory cache (optional Redis later)
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const inferZone = async (lat, lng) => {
  const key = `${Math.round(lat * 10000)}:${Math.round(lng * 10000)}`; // ~10m precision

  // 1. Try memory cache first (super fast)
  if (CACHE.has(key)) {
    const cached = CACHE.get(key);
    if (Date.now() - cached.ts < CACHE_TTL) {
      return cached.zoneId;
    }
  }

  try {
    // 2. First: Try exact polygon intersection (most accurate)
    const zoneWithPolygon = await Zone.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          }
        }
      }
    });

    if (zoneWithPolygon) {
      const zoneId = zoneWithPolygon.name.toLowerCase().replace(/\s+/g, '');
      CACHE.set(key, { zoneId, ts: Date.now() });
      return zoneId;
    }

    // 3. Fallback: Nearest zone center (you already have 2dsphere index)
    const nearest = await Zone.findOne({
      center: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 15000 // 15 km max
        }
      }
    });

    const zoneId = nearest 
      ? nearest.name.toLowerCase().replace(/\s+/g, '')
      : 'global';

    CACHE.set(key, { zoneId, ts: Date.now() });
    return zoneId;

  } catch (err) {
    console.error("inferZone error:", err);
    return 'global';
  }
};