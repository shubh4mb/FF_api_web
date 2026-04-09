/**
 * Geo helpers for Try & Buy radius calculations.
 * All coordinate arrays follow MongoDB convention: [longitude, latitude]
 */

const EARTH_RADIUS_KM = 6371;
const DEFAULT_TB_RADIUS_KM = 7;

/**
 * Convert degrees to radians
 */
function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two points using Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in km
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
 * Check if user is within the T&B radius of a merchant.
 * @param {{ latitude: number, longitude: number } | [number, number]} userCoords
 *   Object with lat/lng OR MongoDB-style [lng, lat] array
 * @param {{ latitude: number, longitude: number } | [number, number]} merchantCoords
 * @param {number} radiusKm - default 7
 * @returns {boolean}
 */
export function isWithinTBRadius(userCoords, merchantCoords, radiusKm = DEFAULT_TB_RADIUS_KM) {
  const [uLat, uLon] = normalizeCoords(userCoords);
  const [mLat, mLon] = normalizeCoords(merchantCoords);
  const dist = haversineDistance(uLat, uLon, mLat, mLon);
  return dist <= radiusKm;
}

/**
 * Filter an array of merchants to only those within T&B radius.
 * Each merchant must have `address.location.coordinates` or `address.latitude/longitude`.
 * @param {Array} merchants
 * @param {{ latitude: number, longitude: number } | [number, number]} userCoords
 * @param {number} radiusKm
 * @returns {Array} Merchants with added `_distance` field (km)
 */
export function filterMerchantsByDistance(merchants, userCoords, radiusKm = DEFAULT_TB_RADIUS_KM) {
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

export default {
  haversineDistance,
  isWithinTBRadius,
  filterMerchantsByDistance,
};
