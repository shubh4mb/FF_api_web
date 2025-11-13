import fetch from 'node-fetch'; // npm i node-fetch if needed

const ZONE_MAP = {
  // Static overrides for your Kerala zones—expand as needed
  'Edappally': 'edapally',
  'Kaloor': 'kaloor',
  'Kakkanad': 'kakanad',
  'Kadavanthara': 'kadavanthara',
  // Add more: suburb → zoneId
};

export async function inferZone(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Prioritize suburb, then city_district, then fallback
    const suburb = data.address?.suburb || data.address?.city_district || data.address?.city || 'fallback_kerala';
    return ZONE_MAP[suburb] || suburb.toLowerCase().replace(/\s+/g, ''); // Normalize to 'edapally'
  } catch (err) {
    console.error('Zone infer error:', err);
    return 'fallback_kerala'; // Safe default
  }
}