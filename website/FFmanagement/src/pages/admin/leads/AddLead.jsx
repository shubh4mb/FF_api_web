import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createLeadApi, getStaffApi } from '@/api/lead';
import { X, ArrowLeft } from 'lucide-react';

function MapModalClickHandler({ setLocation }) {
  useMapEvents({
    click(e) {
      setLocation([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

export default function AddLead() {
  const navigate = useNavigate();
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const isSuperAdmin = adminUser.role === 'superadmin';

  const [staff, setStaff] = useState([]);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [tempMapLocation, setTempMapLocation] = useState(null);
  const [mapCenter] = useState([9.9312, 76.2673]); // default Cochin coordinates

  const [leadForm, setLeadForm] = useState({
    shopName: '',
    ownerName: '',
    phoneNumber: '',
    ownerPhoneNumber: '',
    address: '',
    latitude: '',
    longitude: '',
    status: 'New',
    assignedTo: isSuperAdmin ? '' : adminUser.id || adminUser._id,
    nextFollowUp: ''
  });

  useEffect(() => {
    const loadStaff = async () => {
      if (!isSuperAdmin) return;
      try {
        const res = await getStaffApi();
        setStaff(res || []);
      } catch (error) {
        console.error('Failed to fetch staff list', error);
      }
    };
    loadStaff();
  }, [isSuperAdmin]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!leadForm.shopName || !leadForm.latitude || !leadForm.longitude) {
      toast.error('Please provide Shop Name and Location coordinates');
      return;
    }

    try {
      const res = await createLeadApi(leadForm);
      if (res) {
        toast.success('Shop lead added successfully');
        navigate('/admin/leads');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create lead');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/admin/leads')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Add New Shop Lead</h2>
          <p className="text-sm text-slate-500">Create a new lead to start tracking</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <form onSubmit={handleCreateLead} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Shop Name *</label>
            <input
              type="text"
              required
              value={leadForm.shopName}
              onChange={(e) => setLeadForm({ ...leadForm, shopName: e.target.value })}
              placeholder="e.g. Vintage Apparel Store"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Owner Name</label>
              <input
                type="text"
                value={leadForm.ownerName}
                onChange={(e) => setLeadForm({ ...leadForm, ownerName: e.target.value })}
                placeholder="e.g. John Miller"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Shop Status</label>
              <select
                value={leadForm.status}
                onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Visit Scheduled">Visit Scheduled</option>
                <option value="Negotiating">Negotiating</option>
                <option value="Onboarded">Onboarded</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Shop Phone</label>
              <input
                type="text"
                value={leadForm.phoneNumber}
                onChange={(e) => setLeadForm({ ...leadForm, phoneNumber: e.target.value })}
                placeholder="+91..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Owner Phone</label>
              <input
                type="text"
                value={leadForm.ownerPhoneNumber}
                onChange={(e) => setLeadForm({ ...leadForm, ownerPhoneNumber: e.target.value })}
                placeholder="+91..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Physical Address</label>
            <textarea
              value={leadForm.address}
              onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
              placeholder="Street details, building, landmark..."
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600 uppercase">Map Coordinates *</span>
              <button
                type="button"
                onClick={() => {
                  if (leadForm.latitude && leadForm.longitude) {
                    setTempMapLocation([parseFloat(leadForm.latitude), parseFloat(leadForm.longitude)]);
                  } else {
                    setTempMapLocation(mapCenter);
                  }
                  setIsMapModalOpen(true);
                }}
                className="text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors"
              >
                Select on Map
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Latitude</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={leadForm.latitude}
                  onChange={(e) => setLeadForm({ ...leadForm, latitude: e.target.value })}
                  placeholder="e.g. 9.93"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-700"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Longitude</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={leadForm.longitude}
                  onChange={(e) => setLeadForm({ ...leadForm, longitude: e.target.value })}
                  placeholder="e.g. 76.26"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-700"
                />
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assign to Sales Rep</label>
              <select
                value={leadForm.assignedTo}
                onChange={(e) => setLeadForm({ ...leadForm, assignedTo: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
              >
                <option value="">-- Choose Sales Member --</option>
                {staff.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.role === 'sales' ? 'Sales' : 'Admin'})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Next Follow Up Date</label>
            <input
              type="date"
              value={leadForm.nextFollowUp}
              onChange={(e) => setLeadForm({ ...leadForm, nextFollowUp: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm text-slate-700"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/leads')}
              className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              Save Lead
            </button>
          </div>
        </form>
      </div>

      {isMapModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] animate-in fade-in p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[80vh] animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">Select Location</h3>
                <p className="text-xs text-slate-500">Tap anywhere on the map to drop a pin.</p>
              </div>
              <button onClick={() => setIsMapModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors hover:text-slate-800">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 relative">
              <MapContainer
                center={tempMapLocation || mapCenter}
                zoom={15}
                className="w-full h-full z-0"
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapModalClickHandler setLocation={setTempMapLocation} />
                {tempMapLocation && (
                  <Marker
                    position={tempMapLocation}
                    icon={L.divIcon({
                      html: `<div class="w-6 h-6 bg-sky-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center animate-bounce"><span class="text-white text-[9px] font-bold">New</span></div>`,
                      className: 'temp-marker',
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  />
                )}
              </MapContainer>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tempMapLocation) {
                    setLeadForm(prev => ({
                      ...prev,
                      latitude: tempMapLocation[0].toFixed(6),
                      longitude: tempMapLocation[1].toFixed(6)
                    }));
                    setIsMapModalOpen(false);
                    toast.success("Coordinates selected successfully");
                  } else {
                    toast.error("Please tap on the map to select a location first.");
                  }
                }}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
