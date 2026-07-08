import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLeadsApi, getStaffApi } from '@/api/lead';
import { Phone, User, Plus, Search, Info, MapPin } from 'lucide-react';

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

export default function SalesLeads() {
  const navigate = useNavigate();
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const isSuperAdmin = adminUser.role === 'superadmin';

  const [leads, setLeads] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedRep, setSelectedRep] = useState('');
  
  const [mapCenter, setMapCenter] = useState([9.9312, 76.2673]); // default Cochin coordinates
  const [activeLeadId, setActiveLeadId] = useState(null);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedStatus) params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;
      if (isSuperAdmin && selectedRep) params.assignedTo = selectedRep;

      const res = await getLeadsApi(params);
      const leadsData = res || [];
      setLeads(leadsData);
      
      if (leadsData.length > 0 && !activeLeadId) {
        const firstLead = leadsData[0];
        if (firstLead.location?.latitude && firstLead.location?.longitude) {
          setMapCenter([firstLead.location.latitude, firstLead.location.longitude]);
        }
      }
    } catch (error) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await getStaffApi();
      setStaff(res || []);
    } catch (error) {
      console.error('Failed to fetch staff list', error);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [selectedStatus, selectedRep]);

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadLeads();
  };

  const handleSelectLeadOnMap = (lead) => {
    if (lead.location?.latitude && lead.location?.longitude) {
      setMapCenter([lead.location.latitude, lead.location.longitude]);
      setActiveLeadId(lead._id);
    }
  };

  const statCounts = {
    Total: leads.length,
    New: leads.filter(l => l.status === 'New').length,
    Contacted: leads.filter(l => l.status === 'Contacted').length,
    VisitScheduled: leads.filter(l => l.status === 'Visit Scheduled').length,
    Negotiating: leads.filter(l => l.status === 'Negotiating').length,
    Onboarded: leads.filter(l => l.status === 'Onboarded').length
  };

  return (
    <div className="space-y-6">
      {/* Premium Dashboard stats banner */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total Leads', count: statCounts.Total, color: 'text-slate-800 bg-slate-50 border-slate-200' },
          { label: 'New', count: statCounts.New, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Contacted', count: statCounts.Contacted, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
          { label: 'Visits Pending', count: statCounts.VisitScheduled, color: 'text-orange-600 bg-orange-50 border-orange-200' },
          { label: 'Negotiations', count: statCounts.Negotiating, color: 'text-purple-600 bg-purple-50 border-purple-200' },
          { label: 'Onboarded', count: statCounts.Onboarded, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
        ].map((item, idx) => (
          <div key={idx} className="p-4 rounded-2xl border bg-white flex flex-col shadow-sm transition-all hover:shadow-md">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{item.label}</span>
            <span className={`text-2xl font-black mt-1 ${item.color.split(' ')[0]}`}>{item.count}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Search, Filter, Leads list */}
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm h-[500px] lg:h-[700px]">
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shop, owner, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400 text-slate-700"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Search
              </button>
            </form>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Visit Scheduled">Visit Scheduled</option>
                  <option value="Negotiating">Negotiating</option>
                  <option value="Onboarded">Onboarded</option>
                  <option value="Not Interested">Not Interested</option>
                </select>
              </div>

              {isSuperAdmin && (
                <div className="flex-1">
                  <select
                    value={selectedRep}
                    onChange={(e) => setSelectedRep(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none"
                  >
                    <option value="">All Reps</option>
                    {staff.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-50 custom-scrollbar">
            <div className="flex items-center justify-between pb-2 shrink-0 gap-2">
              <span className="text-sm font-bold text-slate-800">Shop Leads ({leads.length})</span>
              <div className="flex gap-2">
                {isSuperAdmin && (
                  <button
                    onClick={() => navigate('/admin/leads/team')}
                    className="inline-flex items-center gap-1 py-1.5 px-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold border border-slate-200 transition-colors"
                  >
                    Manage Team
                  </button>
                )}
                <button
                  onClick={() => navigate('/admin/leads/add')}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-bold shadow-sm transition-colors"
                >
                  <Plus size={14} /> Add Lead
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400">Loading shop leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No shop leads found</p>
                <p className="text-xs text-slate-400 mt-1">Try expanding filter choices or create one</p>
              </div>
            ) : (
              leads.map(lead => {
                const sStyle = statusMap[lead.status] || statusMap['New'];
                return (
                  <div
                    key={lead._id}
                    className={`pt-3 pb-1 cursor-pointer transition-all hover:bg-slate-50 px-2 rounded-lg ${activeLeadId === lead._id ? 'bg-sky-50/50 border-l-4 border-sky-500' : ''}`}
                    onClick={() => handleSelectLeadOnMap(lead)}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-slate-800 leading-tight truncate max-w-[170px]">
                        {lead.shopName}
                      </h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sStyle.bg}`}>
                        {lead.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      <span>{lead.ownerName || 'Unknown Owner'}</span>
                    </p>

                    <div className="flex justify-between text-[11px] text-slate-400 mt-2 mb-2">
                      <span className="flex items-center gap-1">
                        <Phone size={11} /> {lead.phoneNumber || lead.ownerPhoneNumber || 'N/A'}
                      </span>
                      <span>
                        Last contacted: {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : 'Never'}
                      </span>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/leads/${lead._id}`);
                        }}
                        className="text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-100 transition-colors"
                      >
                        View Full Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Map Component */}
        <div className="lg:col-span-2 relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm h-[500px] lg:h-[700px] z-10 flex flex-col">
          <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-sm border border-slate-200 py-2.5 px-4 rounded-xl shadow-md z-30 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-600 font-semibold">
                Map View: Track Shop locations & leads globally
              </span>
            </div>
          </div>

          <div className="w-full h-full relative">
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
                            className="bg-sky-500 text-white text-[10px] py-1.5 px-3 rounded-lg font-bold hover:bg-sky-600 w-full"
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
      </div>
    </div>
  );
}
