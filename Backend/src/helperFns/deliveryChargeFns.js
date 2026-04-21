import { getRoadDistance } from './orsHelper.js';
import { haversineDistance } from './geoHelpers.js';

/**
 * DELIVERY CHARGE HELPER
 * 
 * Logic:
 * 1. Displacement (Haversine) is used for serviceability range checks (e.g., 7km threshold).
 * 2. Road Distance (ORS) is used for actual pricing and rider info.
 */
export async function calculateDeliveryCharge({
  userCoords,
  merchantCoords,
  deliveryPerKmRate = 12,
  returnPerKmRate = 7,
  waitingCharge = 10,
  maxServiceableRadius = 15 // Absolute hard limit for ORS calls
}) {
  if (!userCoords?.length || !merchantCoords?.length) {
    return { 
      displacementKm: 0,
      roadDistanceKm: 0, 
      deliveryCharge: 0, 
      returnCharge: 0, 
      estimatedTime: 0, 
      calculationMethod: "none" 
    };
  }

  const userLat = userCoords[1];
  const userLng = userCoords[0];
  const shopLat = merchantCoords[1];
  const shopLng = merchantCoords[0];

  // 1. 🛩️ Calculate Displacement (Haversine) — FREE and used for range check
  const displacementKm = Number(haversineDistance(userLat, userLng, shopLat, shopLng).toFixed(2));

  // 2. 🛣️ Try road distance with ORS (only if within a reasonable delivery range)
  let roadDistanceKm = null;
  let calculationMethod = "road";
  let roadDurationMins = null;

  if (displacementKm <= maxServiceableRadius) {
    const roadResult = await getRoadDistance(userCoords, merchantCoords);
    roadDistanceKm = roadResult?.distanceKm ?? null;
    roadDurationMins = roadResult?.durationMins ?? null;
  }

  // 3. 🛩️ Fallback to Haversine for pricing if ORS is skipped, fails, or returns no route
  if (roadDistanceKm === null) {
     roadDistanceKm = displacementKm;
     calculationMethod = "haversine (fallback)";
  }

  const finalizedRoadDistance = Number(roadDistanceKm.toFixed(2));

  // Charge Calculation (using Road Distance)
  const dCharge = finalizedRoadDistance * deliveryPerKmRate + waitingCharge;
  const deliveryCharge = Math.ceil(dCharge);

  const rCharge = finalizedRoadDistance * returnPerKmRate;
  const returnCharge = Math.ceil(rCharge);

  // Estimated Time Calculation
  const riderToPickupTime = 15;
  const deliveryLegTime = roadDurationMins 
    ? roadDurationMins 
    : Math.ceil(20 + (finalizedRoadDistance * 4));
    
  const estimatedTime = riderToPickupTime + deliveryLegTime;

  return {
    displacementKm,      // Use this for "is within 7km"
    roadDistanceKm: finalizedRoadDistance, // Use this for pricing
    deliveryCharge,
    returnCharge,
    estimatedTime,
    calculationMethod
  };
}

