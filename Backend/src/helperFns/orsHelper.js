/**
 * OSRM Helper for Road Distance and Time Calculations (Self-hosted)
 */

/**
 * Get actual road distance and estimated travel time between two points.
 * @param {[number, number]} startCoords - [longitude, latitude]
 * @param {[number, number]} endCoords - [longitude, latitude]
 * @returns {Promise<{distanceKm: number, durationMins: number}|null>} 
 */
export async function getRoadDistance(startCoords, endCoords) {
  const baseUrl = process.env.OSRM_BASE_URL || 'http://localhost:5001';
  
  if (!startCoords || startCoords.length < 2 || !endCoords || endCoords.length < 2) {
    console.warn("⚠️ OSRM: Invalid coordinates provided.");
    return null;
  }

  const [startLng, startLat] = startCoords;
  const [endLng, endLat] = endCoords;

  try {
    const url = `${baseUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=false`;
    
    const response = await fetch(url);

    if (!response.ok) {
      console.error("❌ OSRM API Error:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn("⚠️ OSRM: No route found.");
      return null;
    }

    const route = data.routes[0];
    
    // OSRM returns distance in METERS and duration in SECONDS
    const distanceKm = route.distance / 1000;
    const durationMins = Math.ceil(route.duration / 60);
    
    console.log(`🛣️ OSRM Route found: ${distanceKm.toFixed(2)} km, ~${durationMins} mins`);
    
    return {
      distanceKm,
      durationMins
    };
  } catch (error) {
    console.error("❌ OSRM Helper Exception:", error.message);
    return null;
  }
}

export default {
  getRoadDistance
};
