// Reverse geocoding: lat, lng → city, state, country
export const getLocationFromCoords = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`
    );
    
    if (!response.ok) throw new Error("Geocoding failed");

    const data = await response.json();
    const address = data.address;

    // Extract city/town/village + state
    const city = address.city || 
                 address.town || 
                 address.village || 
                 address.suburb || 
                 address.county ||
                 "Unknown City";

    const state = address.state || address.province || "Unknown State";
    const country = address.country || "Unknown";

    return { city, state, country };
  } catch (err) {
    console.warn("Reverse geocoding failed:", err.message);
    return { city: "Unknown", state: "Unknown", country: "Unknown" };
  }
};