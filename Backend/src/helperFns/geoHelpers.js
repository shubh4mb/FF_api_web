/**
 * Geo helpers for Try & Buy radius calculations.
 * All coordinate arrays follow MongoDB convention: [longitude, latitude]
 */
import { getRoadDistance } from './orsHelper.js';

const EARTH_RADIUS_KM = 6371;
/**
 * Convert degrees to radians
 */
function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two points using Haversine formula.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Check if user is within a specific radius of a merchant.
 * @param {{ latitude: number, longitude: number } | [number, number]} userCoords
 *   Object with lat/lng OR MongoDB-style [lng, lat] array
 * @param {{ latitude: number, longitude: number } | [number, number]} merchantCoords
 * @param {number} radiusKm - radius in km
 * @returns {boolean}
 */
export function isWithinTBRadius(userCoords, merchantCoords, radiusKm) {
  if (radiusKm == null) throw new Error("radiusKm is required for isWithinTBRadius");
  const [uLat, uLon] = normalizeCoords(userCoords);
  const [mLat, mLon] = normalizeCoords(merchantCoords);
  const dist = haversineDistance(uLat, uLon, mLat, mLon);
  return dist <= radiusKm;
}

/**
 * Filter an array of merchants to only those within a specific radius.
 * @param {Array} merchants
 * @param {{ latitude: number, longitude: number } | [number, number]} userCoords
 * @param {number} radiusKm
 * @returns {Array} Merchants with added `_distance` field (km)
 */
export function filterMerchantsByDistance(merchants, userCoords, radiusKm) {
  if (radiusKm == null) throw new Error("radiusKm is required for filterMerchantsByDistance");
  const [uLat, uLon] = normalizeCoords(userCoords);

  return merchants
    .map((merchant) => {
      const coords = getMerchantCoords(merchant);
      if (!coords) return null;

      const [mLat, mLon] = coords;
      const distance = haversineDistance(uLat, uLon, mLat, mLon);

      if (distance > radiusKm) return null;

      // Attach distance for frontend display / sorting
      const m = merchant.toObject ? merchant.toObject() : { ...merchant };
      m._distance = Math.round(distance * 100) / 100; // 2 decimal places
      return m;
    })
    .filter(Boolean)
    .sort((a, b) => a._distance - b._distance);
}

/**
 * Normalize various coordinate formats to [latitude, longitude].
 */
function normalizeCoords(coords) {
  if (Array.isArray(coords)) {
    // MongoDB convention: [lng, lat]
    return [coords[1], coords[0]];
  }
  return [coords.latitude, coords.longitude];
}

/**
 * Extract coordinates from a merchant document.
 * Returns [latitude, longitude] or null.
 */
function getMerchantCoords(merchant) {
  // Prefer GeoJSON location
  const loc = merchant.address?.location?.coordinates;
  if (loc && loc.length === 2) {
    return [loc[1], loc[0]]; // [lng, lat] → [lat, lng]
  }
  // Fallback to flat fields
  if (merchant.address?.latitude != null && merchant.address?.longitude != null) {
    return [merchant.address.latitude, merchant.address.longitude];
  }
  return null;
}

/**
 * Filter an array of merchants to only those within a specific radius based on road distance.
 * @param {Array} merchants
 * @param {{ latitude: number, longitude: number } | [number, number]} userCoords
 * @param {number} radiusKm
 * @returns {Promise<Array>} Merchants with added `_distance` field (km)
 */
export async function filterMerchantsByRoadDistance(merchants, userCoords, radiusKm) {
  if (radiusKm == null) throw new Error("radiusKm is required for filterMerchantsByRoadDistance");
  const [uLat, uLon] = normalizeCoords(userCoords);

  // 1. Broad filter using fast Haversine check to filter out far merchants (e.g. > 1.5 * radiusKm)
  // This avoids making unnecessary external API calls for far-away merchants.
  const potentialMerchants = merchants
    .map((merchant) => {
      const coords = getMerchantCoords(merchant);
      if (!coords) return null;

      const [mLat, mLon] = coords;
      const distance = haversineDistance(uLat, uLon, mLat, mLon);

      if (distance > radiusKm * 1.5) return null;

      const m = merchant.toObject ? merchant.toObject() : { ...merchant };
      m._distance = Math.round(distance * 100) / 100; // 2 decimal places
      return m;
    })
    .filter(Boolean);

  // 2. Resolve actual road distance for the remaining potential merchants
  const nearbyMerchants = [];
  const roadPromises = potentialMerchants.map(async (m) => {
    const coords = getMerchantCoords(m);
    if (!coords) return;

    // getRoadDistance expects startCoords [lng, lat] and endCoords [lng, lat]
    const roadResult = await getRoadDistance([uLon, uLat], [coords[1], coords[0]]);
    const roadDistance = roadResult?.distanceKm ?? m._distance; // fallback to Haversine if ORS fails

    if (roadDistance <= radiusKm) {
      m._distance = Math.round(roadDistance * 100) / 100;
      nearbyMerchants.push(m);
    }
  });

  await Promise.all(roadPromises);

  // 3. Sort by road distance
  return nearbyMerchants.sort((a, b) => a._distance - b._distance);
}

export default {
  haversineDistance,
  isWithinTBRadius,
  filterMerchantsByDistance,
  filterMerchantsByRoadDistance,
};
