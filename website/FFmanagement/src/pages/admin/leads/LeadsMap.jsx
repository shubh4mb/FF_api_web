import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLeadsApi } from '@/api/lead';
import { Phone, User, ArrowLeft, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';

const statusMap = {
  'New': { color: '#3B82F6', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Contacted': { color: '#EAB308', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'Visit Scheduled': { color: '#F97316', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  'Negotiating': { color: '#A855F7', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Onboarded': { color: '#10B981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Not Interested': { color: '#6B7280', bg: 'bg-slate-50 text-slate-700 border-slate-200' }
};

const createStatusIcon = (status) => {
  const cfg = statusMap[status] || statusMap['New'];
  return L.divIcon({
    className: 'custom-lead-pin',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute w-6 h-6 rounded-full opacity-30 animate-ping" style="background-color: ${cfg.color}"></div>
        <div class="relative w-4.5 h-4.5 rounded-full border-2 border-white shadow-md transition-all duration-300 hover:scale-125" style="background-color: ${cfg.color}"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 15, { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

export default function LeadsMap() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState([9.9961, 76.2942]); // default Kaloor, Kochi coordinates
  const [activeLeadId, setActiveLeadId] = useState(null);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await getLeadsApi({});
        const leadsData = res || [];
        setLeads(leadsData);
        
        if (leadsData.length > 0) {
          const firstLead = leadsData.find(l => l.location?.latitude && l.location?.longitude);
          if (firstLead) {
            setMapCenter([firstLead.location.latitude, firstLead.location.longitude]);
          }
        }
      } catch (error) {
        toast.error('Failed to load map data');
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[700px] space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500">Loading map data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[85vh] max-h-[900px]">
      <div className="flex items-center justify-between p-4 bg-white rounded-t-2xl border-x border-t border-slate-200 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/leads')}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-sky-500" />
              Global Leads Map
            </h1>
            <p className="text-xs text-slate-500">Track and visualize all shop locations</p>
          </div>
        </div>
        <div className="bg-sky-50 px-3 py-1.5 rounded-full border border-sky-100">
          <span className="text-xs font-bold text-sky-700">{leads.filter(l => l.location?.latitude).length} Locations Mapped</span>
        </div>
      </div>
      
      <div className="relative flex-1 bg-slate-100 rounded-b-2xl border-x border-b border-slate-200 overflow-hidden shadow-sm z-10">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap lat={mapCenter[0]} lng={mapCenter[1]} />

          {leads.map(lead => (
            lead.location?.latitude && lead.location?.longitude && (
              <Marker
                key={lead._id}
                position={[lead.location.latitude, lead.location.longitude]}
                icon={createStatusIcon(lead.status)}
                eventHandlers={{
                  click: () => setActiveLeadId(lead._id),
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1 max-w-[200px]">
                    <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">{lead.shopName}</h4>
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <User size={10} /> Owner: {lead.ownerName || 'N/A'}
                    </p>
                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                      <Phone size={10} /> Phone: {lead.phoneNumber || 'N/A'}
                    </p>
                    <div className="flex gap-1.5 border-t border-slate-100 pt-2">
                      <button
                        onClick={() => navigate(`/admin/leads/${lead._id}`)}
                        className="bg-sky-500 text-white text-[10px] py-1.5 px-3 rounded-lg font-bold hover:bg-sky-600 w-full transition-colors"
                      >
                        Open Details
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
