/**
 * OpenRouteService Helper for Road Distance and Time Calculations
 */

/**
 * Get actual road distance and estimated travel time between two points.
 * @param {[number, number]} startCoords - [longitude, latitude]
 * @param {[number, number]} endCoords - [longitude, latitude]
 * @returns {Promise<{distanceKm: number, durationMins: number}|null>} 
 */
export async function getRoadDistance(startCoords, endCoords) {
  const apiKey = process.env.OPEN_ROUTE_SERVICE_KEY || process.env.OPEN_ROUTE_SERVICE_API_KEY;
  
  if (!apiKey) {
    console.warn("⚠️ ORS: OPEN_ROUTE_SERVICE_KEY not found in environment variables.");
    return null;
  }

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': apiKey
      },
      body: JSON.stringify({
        coordinates: [startCoords, endCoords],
        units: 'km'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ ORS API Error:", response.status, errorData);
      return null;
    }

    const data = await response.json();
    
    // Structure: routes[0].summary.distance and routes[0].summary.duration (seconds)
    const summary = data.routes?.[0]?.summary;
    
    if (summary && summary.distance !== undefined) {
      const distanceKm = Number(summary.distance);
      const durationMins = Math.ceil((summary.duration || 0) / 60);
      
      console.log(`🛣️ Road route found: ${distanceKm.toFixed(2)} km, ~${durationMins} mins`);
      
      return {
        distanceKm,
        durationMins
      };
    }
    
    console.warn("⚠️ ORS: No routes found in response.");
    return null;
  } catch (error) {
    console.error("❌ ORS Helper Exception:", error.message);
    return null;
  }
}

export default {
  getRoadDistance
};
