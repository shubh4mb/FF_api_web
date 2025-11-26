import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { checkOverlapApi, getZones , addZone } from '@/api/zone';
import { getLocationFromCoords } from '@/utils/getLocationFromCoordinates';

export default function ZoneCreator() {
  const [center, setCenter] = useState(null);
  const [boundary, setBoundary] = useState([]);
  const [existingZones, setExistingZones] = useState([]);
  const [isOverlapping, setIsOverlapping] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [city, setCity] = useState("");
const [state, setState] = useState("");

useEffect(() => {
  if (center) {
    const [lat, lng] = center;
    getLocationFromCoords(lat, lng).then(({ city, state }) => {
      setCity(city);
      setState(state);
    });
  }
}, [center]);

  // Load existing zones
  useEffect(() => {
    const loadZones = async () => {
      // const res = await fetch('http://localhost:5000/api/zones');
      const data = await getZones();
      setExistingZones(data.data || []);
    };
    loadZones();
  }, []);

  function LocationHandler() {
    useMapEvents({
      click(e) {
        if (!center) {
          setCenter([e.latlng.lat, e.latlng.lng]);
        } else {
          setBoundary((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
        }
      },
    });
    return null;
  }

  // Check overlap while drawing
  useEffect(() => {
    if (boundary.length < 3) return;

    const checkOverlap = async () => {
      const polygon = {
        type: "Polygon",
        coordinates: [[
          ...boundary.map(p => [p[1], p[0]]),
          [boundary[0][1], boundary[0][0]]
        ]]
      };

      // const res = await fetch('http://localhost:5000/api/zones/check-overlap', {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ polygon })
      // });
      //use api from api file api/zone.js
      const res =await checkOverlapApi({
  polygon: {
    type: "Polygon",
    coordinates: [[
      ...boundary.map(p => [p[1], p[0]]),
      [boundary[0][1], boundary[0][0]]
    ]]
  }
});
console.log(res);


      const data = res;
      setIsOverlapping(data.overlap === true);
    };

    checkOverlap();
  }, [boundary]);

  const handleSubmit = async () => {
    if (isOverlapping) {
      alert("Zone overlaps with existing zone!");
      return;
    }

      const payload = {
          city,
        state,
        zoneName,
      centerCoordinaties: {
        type: 'Point',
        coordinates: [center[1], center[0]],
      },
      boundary: {
        type: 'Polygon',
        coordinates: [[
          ...boundary.map(p => [p[1], p[0]]),
          [boundary[0][1], boundary[0][0]]
        ]],
      },
    };

    // await fetch('http://localhost:5000/api/zones', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload),
    // });
    await addZone(payload);
    alert('Zone saved');
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">Create Zone</h1>
      <p>First click sets center. Next clicks draw boundary.</p>

      <MapContainer center={[9.9312, 76.2673]} zoom={13} style={{ height: '500px' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <LocationHandler />

        {/* Existing Zones (Blue) */}
        {existingZones.map((z, i) => (
          z.boundary?.coordinates?.[0] && (
            <Polygon
              key={i}
              positions={z.boundary.coordinates[0].map(p => [p[1], p[0]])}
              pathOptions={{ color: 'blue' }}
            />
          )
        ))}

        {/* New Zone Drawing */}
        {center && <Marker position={center} />}
        {boundary.length > 2 && (
          <Polygon
            positions={boundary}
            pathOptions={{ color: isOverlapping ? 'red' : 'green' }}
          />
        )}
      </MapContainer>
      <div className="mt-4 mb-4">
  <label className="block text-sm font-medium mb-2">
    Zone Name <span className="text-red-500">*</span>
  </label>
  <input
    type="text"
    value={zoneName}
    onChange={(e) => setZoneName(e.target.value)}
    placeholder="e.g., Marine Drive, Kakkanad Central"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    required
  />
</div>

      <button
        onClick={handleSubmit}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Save Zone
      </button>
    </div>
  );
}
