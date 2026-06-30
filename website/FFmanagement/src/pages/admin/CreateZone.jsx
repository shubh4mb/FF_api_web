import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { checkOverlapApi, getZones , addZone } from '@/api/zone';
import { getLocationFromCoords } from '@/utils/getLocationFromCoordinates';
import { ArrowLeft, Undo2, RotateCcw, Save, MapPin, Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ZoneCreator() {
  const navigate = useNavigate();
  const [center, setCenter] = useState(null);
  const [boundary, setBoundary] = useState([]);
  const [existingZones, setExistingZones] = useState([]);
  const [isOverlapping, setIsOverlapping] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (center) {
      const [lat, lng] = center;
      getLocationFromCoords(lat, lng).then(({ city, state }) => {
        setCity(city || "");
        setState(state || "");
      }).catch(err => {
        console.error("Failed to get location from coordinates:", err);
      });
    } else {
      setCity("");
      setState("");
    }
  }, [center]);

  // Load existing zones
  useEffect(() => {
    const loadZones = async () => {
      try {
        const data = await getZones();
        setExistingZones(data.zones || []);
      } catch (error) {
        toast.error("Failed to load existing zones");
      }
    };
    loadZones();
  }, []);

  function LocationHandler() {
    useMapEvents({
      click(e) {
        if (!center) {
          setCenter([e.latlng.lat, e.latlng.lng]);
          toast.success("Center point set! Now click to draw the boundary.");
        } else {
          setBoundary((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
        }
      },
    });
    return null;
  }

  // Check overlap while drawing
  useEffect(() => {
    if (boundary.length < 3) {
      setIsOverlapping(false);
      return;
    }

    const checkOverlap = async () => {
      try {
        const res = await checkOverlapApi({
          polygon: {
            type: "Polygon",
            coordinates: [[
              ...boundary.map(p => [p[1], p[0]]),
              [boundary[0][1], boundary[0][0]]
            ]]
          }
        });
        setIsOverlapping(res.overlap === true);
      } catch (error) {
        console.error("Overlap check failed", error);
      }
    };

    checkOverlap();
  }, [boundary]);

  const handleUndo = () => {
    if (boundary.length > 0) {
      setBoundary((prev) => prev.slice(0, -1));
      toast.success("Last boundary point removed");
    } else if (center) {
      setCenter(null);
      setCity("");
      setState("");
      toast.success("Center point removed");
    }
  };

  const handleClear = () => {
    setCenter(null);
    setBoundary([]);
    setIsOverlapping(false);
    setCity("");
    setState("");
    setZoneName("");
    toast.success("Drawing cleared");
  };

  const handleSubmit = async () => {
    if (!zoneName.trim()) {
      toast.error("Please enter a zone name");
      return;
    }
    if (isOverlapping) {
      toast.error("Zone overlaps with an existing zone!");
      return;
    }
    if (!center || boundary.length < 3) {
      toast.error("Please set a center and draw a valid boundary (at least 3 points)");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        city,
        state,
        zoneName,
        centerCoordinates: {
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

      await addZone(payload);
      toast.success('Zone saved successfully');
      navigate('/admin/zones');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save zone');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/zones')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium text-sm mb-2"
          >
            <ArrowLeft size={16} />
            Back to Zones
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Zone</h1>
          <p className="text-slate-500 text-sm mt-1">
            Draw a delivery zone boundary on the map to define merchant and courier operations.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Control Panel */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Instructions Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers size={16} className="text-sky-500" />
              Drawing Guide
            </h2>
            
            <div className="space-y-3 text-xs text-slate-600">
              <div className={`p-3 rounded-lg border transition-colors ${!center ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-slate-50 border-slate-100'}`}>
                <span className="font-bold block mb-1">1. Set Center Point</span>
                Click on the map to place the initial center coordinate for the zone.
              </div>

              <div className={`p-3 rounded-lg border transition-colors ${center && boundary.length < 3 ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-slate-50 border-slate-100'}`}>
                <span className="font-bold block mb-1">2. Draw Boundary ({boundary.length} pts)</span>
                Click points on the map to construct the polygon boundary (minimum 3 points required).
              </div>

              <div className={`p-3 rounded-lg border transition-colors ${center && boundary.length >= 3 ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-slate-50 border-slate-100'}`}>
                <span className="font-bold block mb-1">3. Check and Save</span>
                Ensure there are no overlaps (indicated in red) and save your new zone.
              </div>
            </div>

            {isOverlapping && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-medium animate-pulse">
                Warning: The current boundary overlaps with an existing zone. Please undo or adjust the points.
              </div>
            )}
          </div>

          {/* Form & Actions Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Zone Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="e.g., Marine Drive, Kakkanad Central"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm"
                required
              />
            </div>

            {center && (
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-medium">City</span>
                  <span className="text-slate-700 font-semibold flex items-center gap-1 mt-0.5">
                    <MapPin size={12} className="text-slate-400" />
                    {city || 'Fetching...'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">State</span>
                  <span className="text-slate-700 font-semibold mt-0.5 block">{state || 'Fetching...'}</span>
                </div>
              </div>
            )}

            {/* Buttons Row */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!center || boundary.length < 3 || isOverlapping || !zoneName.trim() || isSaving}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                <Save size={16} />
                {isSaving ? 'Saving Zone...' : 'Save Zone'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!center && boundary.length === 0}
                  className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  title="Undo last point clicked"
                >
                  <Undo2 size={14} />
                  Undo Point
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!center && boundary.length === 0}
                  className="py-2 px-3 border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50 disabled:hover:bg-transparent rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  title="Clear all points"
                >
                  <RotateCcw size={14} />
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Map Area */}
        <div className="lg:col-span-2">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[550px] relative z-10">
            <MapContainer center={[9.9312, 76.2673]} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              <LocationHandler />

              {/* Existing Zones (Blue) */}
              {existingZones.map((z, i) => (
                z.boundary?.coordinates?.[0] && (
                  <Polygon
                    key={i}
                    positions={z.boundary.coordinates[0].map(p => [p[1], p[0]])}
                    pathOptions={{ color: '#0EA5E9', fillColor: '#0EA5E9', fillOpacity: 0.15, weight: 2 }}
                  />
                )
              ))}

              {/* New Zone Drawing: Center Pin */}
              {center && <Marker position={center} />}

              {/* New Zone Drawing: Boundary line/polygon */}
              {boundary.length > 0 && boundary.length < 3 && (
                <Polyline
                  positions={boundary}
                  pathOptions={{ color: '#F97316', weight: 3, dashArray: '5, 5' }}
                />
              )}

              {boundary.length >= 3 && (
                <Polygon
                  positions={boundary}
                  pathOptions={{
                    color: isOverlapping ? '#EF4444' : '#10B981',
                    fillColor: isOverlapping ? '#EF4444' : '#10B981',
                    fillOpacity: 0.25,
                    weight: 3
                  }}
                />
              )}

              {/* Custom circle markers for boundary vertices to make them visually distinct and interactive */}
              {boundary.map((pos, idx) => (
                <CircleMarker
                  key={idx}
                  center={pos}
                  radius={5}
                  pathOptions={{
                    color: '#FFFFFF',
                    fillColor: '#F97316',
                    fillOpacity: 1,
                    weight: 2
                  }}
                />
              ))}
            </MapContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
