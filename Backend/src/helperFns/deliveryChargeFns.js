// ----------------------------
// Haversine Distance Calculator
// ----------------------------
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // earth radius (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ----------------------------
// DELIVERY CHARGE HELPER
// ----------------------------
// Formula:
// One-way → ₹15/km
// Return  → ₹7.5/km
// Waiting → ₹10 fixed
// total = distance * 22.5 + 10
// ----------------------------

export function calculateDeliveryCharge({
  userCoords,
  merchantCoords,
  deliveryPerKmRate = 12,
  returnPerKmRate = 7,
  waitingCharge = 10
}) {
  if (!userCoords?.length || !merchantCoords?.length) {
    return { distanceKm: 0, deliveryCharge: 0, returnCharge: 0, estimatedTime: 0 };
  }

  const userLat = userCoords[1];
  const userLng = userCoords[0];
  const shopLat = merchantCoords[1];
  const shopLng = merchantCoords[0];

  // Distance Calculation
  const distanceKm = calculateDistanceKm(userLat, userLng, shopLat, shopLng);
  const roundedDistance = Number(distanceKm.toFixed(2));

  // Charge Calculation using config
  const dCharge = roundedDistance * deliveryPerKmRate + waitingCharge;
  const deliveryCharge = Math.ceil(dCharge);

  const rCharge = roundedDistance * returnPerKmRate;
  const returnCharge = Math.ceil(rCharge);

  // Estimated Time Calculation (minutes)
  // Rider to pickup: 15 mins base + 3 mins per km
  // Pickup to delivery: 20 mins base + 4 mins per km
  const riderToPickupTime = 15;
  const pickupToDeliveryTime = Math.ceil(20 + (roundedDistance * 4));
  const estimatedTime = riderToPickupTime + pickupToDeliveryTime;

  return {
    distanceKm: roundedDistance,
    deliveryCharge,
    returnCharge,
    estimatedTime
  };
}
