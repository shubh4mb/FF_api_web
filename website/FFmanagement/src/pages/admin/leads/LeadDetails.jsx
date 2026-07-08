import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getLeadByIdApi,
  updateLeadApi,
  addLeadLogApi,
  deleteLeadApi,
  getStaffApi
} from '@/api/lead';
import {
  Phone, MapPin, User, Calendar, Edit, Trash2, ArrowLeft,
  CheckCircle2, MessageSquare, Clock, Shield, X
} from 'lucide-react';

const statusMap = {
  'New': { bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Contacted': { bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'Visit Scheduled': { bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  'Negotiating': { bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Onboarded': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Not Interested': { bg: 'bg-slate-50 text-slate-700 border-slate-200' }
};

function MapModalClickHandler({ setLocation }) {
  useMapEvents({
    click(e) {
      setLocation([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const isSuperAdmin = adminUser.role === 'superadmin';

  const [activeLead, setActiveLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [staff, setStaff] = useState([]);
  
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [tempMapLocation, setTempMapLocation] = useState(null);

  const [leadForm, setLeadForm] = useState({
    shopName: '',
    ownerName: '',
    phoneNumber: '',
    ownerPhoneNumber: '',
    address: '',
    latitude: '',
    longitude: '',
    status: 'New',
    assignedTo: '',
    nextFollowUp: ''
  });

  const [logForm, setLogForm] = useState({
    type: 'Call',
    response: '',
    status: '',
    nextFollowUp: ''
  });

  const fetchLeadDetails = useCallback(async () => {
    try {
      const res = await getLeadByIdApi(id);
      if (res) {
        setActiveLead(res);
        setLogForm(prev => ({
          ...prev,
          status: res.status,
          nextFollowUp: res.nextFollowUp ? res.nextFollowUp.split('T')[0] : ''
        }));
      }
    } catch (error) {
      toast.error('Failed to get lead details');
      navigate('/admin/leads');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchLeadDetails();
    if (isSuperAdmin) {
      getStaffApi().then(res => setStaff(res || [])).catch(console.error);
    }
  }, [fetchLeadDetails, isSuperAdmin]);

  const enableEditMode = () => {
    if (!activeLead) return;
    setLeadForm({
      shopName: activeLead.shopName,
      ownerName: activeLead.ownerName || '',
      phoneNumber: activeLead.phoneNumber || '',
      ownerPhoneNumber: activeLead.ownerPhoneNumber || '',
      address: activeLead.address || '',
      latitude: activeLead.location.latitude,
      longitude: activeLead.location.longitude,
      status: activeLead.status,
      assignedTo: activeLead.assignedTo?._id || activeLead.assignedTo || '',
      nextFollowUp: activeLead.nextFollowUp ? activeLead.nextFollowUp.split('T')[0] : ''
    });
    setIsEditMode(true);
  };

  const handleUpdateLead = async (e) => {
    e.preventDefault();
    try {
      const updateData = { ...leadForm };
      if (!isSuperAdmin) {
        delete updateData.assignedTo;
      }
      const res = await updateLeadApi(id, updateData);
      if (res) {
        toast.success('Lead details updated');
        setIsEditMode(false);
        fetchLeadDetails();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update lead');
    }
  };

  const handleDeleteLead = async () => {
    if (!window.confirm('Are you sure you want to delete this shop lead?')) return;
    try {
      await deleteLeadApi(id);
      toast.success('Lead deleted');
      navigate('/admin/leads');
    } catch (error) {
      toast.error('Failed to delete lead');
    }
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!logForm.response.trim()) {
      toast.error('Please enter response notes');
      return;
    }
    try {
      const res = await addLeadLogApi(id, logForm);
      if (res) {
        toast.success('Interaction logged successfully');
        setLogForm(prev => ({ ...prev, response: '' }));
        fetchLeadDetails();
      }
    } catch (error) {
      toast.error('Failed to save communication log');
    }
  };

  const handleConvertToMerchant = () => {
    const params = new URLSearchParams({
      shopName: activeLead.shopName || '',
      ownerName: activeLead.ownerName || '',
      phoneNumber: activeLead.phoneNumber || activeLead.ownerPhoneNumber || ''
    }).toString();
    navigate(`/admin/add-merchant?${params}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-2">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Loading lead profile...</p>
      </div>
    );
  }

  if (!activeLead) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin/leads')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shop Lead Profile</span>
            <h2 className="text-xl font-bold text-slate-800 leading-tight">{activeLead.shopName}</h2>
          </div>
        </div>

        {!isEditMode && (
          <div className="flex gap-2">
            <button
              onClick={enableEditMode}
              className="flex items-center gap-1.5 py-2 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Edit size={16} /> Edit Details
            </button>
            {isSuperAdmin && (
              <button
                onClick={handleDeleteLead}
                className="flex items-center gap-1.5 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Lead Details or Edit Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {isEditMode ? (
            <form onSubmit={handleUpdateLead} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-100 pb-3 mb-4">Edit Information</h3>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={leadForm.shopName}
                  onChange={(e) => setLeadForm({ ...leadForm, shopName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Owner Name</label>
                  <input
                    type="text"
                    value={leadForm.ownerName}
                    onChange={(e) => setLeadForm({ ...leadForm, ownerName: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Lead Status</label>
                  <select
                    value={leadForm.status}
                    onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Owner Phone</label>
                  <input
                    type="text"
                    value={leadForm.ownerPhoneNumber}
                    onChange={(e) => setLeadForm({ ...leadForm, ownerPhoneNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Physical Address</label>
                <textarea
                  value={leadForm.address}
                  onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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
                      }
                      setIsMapModalOpen(true);
                    }}
                    className="text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors"
                  >
                    Update on Map
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-100 pb-3">Lead Information</h3>
              
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Status</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusMap[activeLead.status]?.bg || statusMap['New'].bg}`}>
                    {activeLead.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 shrink-0"><User size={18} /></div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">Owner</span>
                      <span className="text-sm text-slate-700 font-semibold">{activeLead.ownerName || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 shrink-0"><Phone size={18} /></div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">Shop Phone</span>
                      <span className="text-sm text-slate-700 font-semibold">{activeLead.phoneNumber || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 shrink-0"><Phone size={18} /></div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">Owner Phone</span>
                      <span className="text-sm text-slate-700 font-semibold">{activeLead.ownerPhoneNumber || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 shrink-0"><Shield size={18} /></div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">Assigned Rep</span>
                      <span className="text-sm text-slate-700 font-semibold">{activeLead.assignedTo?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 shrink-0"><MapPin size={18} /></div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">Address & Coordinates</span>
                    <span className="text-sm text-slate-700 block leading-normal">{activeLead.address || 'N/A'}</span>
                    <span className="text-xs text-slate-500 mt-1 block bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                      {activeLead.location?.latitude.toFixed(5)}, {activeLead.location?.longitude.toFixed(5)}
                    </span>
                  </div>
                </div>

                {activeLead.nextFollowUp && (
                  <div className="flex items-start gap-3 border-t border-slate-200/60 pt-4">
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-500 shrink-0"><Calendar size={18} /></div>
                    <div>
                      <span className="text-[10px] text-amber-600 block font-bold uppercase mb-0.5">Next Follow Up</span>
                      <span className="text-sm text-slate-800 font-bold">
                        {new Date(activeLead.nextFollowUp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                )}

                {isSuperAdmin && activeLead.status === 'Onboarded' && (
                  <div className="border-t border-emerald-100 pt-4">
                    <button
                      onClick={handleConvertToMerchant}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                    >
                      <CheckCircle2 size={18} /> Create Official Merchant Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Communication Logs */}
        <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[700px]">
          <div className="p-5 border-b border-slate-100 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 uppercase">Communication History</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 space-y-5 custom-scrollbar">
            {activeLead.logs && activeLead.logs.length > 0 ? (
              activeLead.logs.map((log, idx) => (
                <div key={idx} className="relative flex gap-4">
                  {idx !== activeLead.logs.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-[-28px] w-0.5 bg-slate-200"></div>
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 shrink-0 shadow-sm ${log.type === 'Call' ? 'bg-sky-500' : log.type === 'Visit' ? 'bg-orange-500' : 'bg-slate-500'}`}>
                    {log.type[0]}
                  </div>
                  <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">{log.type}</span>
                        <span className="text-xs text-slate-500">by {log.salesPerson}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">{log.response}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-sm text-slate-500 font-medium">No interaction logs logged yet.</p>
                <p className="text-xs text-slate-400 mt-1">Use the form below to add the first log.</p>
              </div>
            )}
          </div>

          <form onSubmit={handleAddLog} className="p-5 border-t border-slate-200 bg-white shrink-0 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase mb-2">Log New Interaction</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Log Type</span>
                <select
                  value={logForm.type}
                  onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                >
                  <option value="Call">Call</option>
                  <option value="Visit">Shop Visit</option>
                  <option value="Email">Email</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Updated Status</span>
                <select
                  value={logForm.status}
                  onChange={(e) => setLogForm({ ...logForm, status: e.target.value })}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
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

            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Next Follow Up Date</span>
              <input
                type="date"
                value={logForm.nextFollowUp}
                onChange={(e) => setLogForm({ ...logForm, nextFollowUp: e.target.value })}
                className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Response Notes *</span>
              <textarea
                required
                value={logForm.response}
                onChange={(e) => setLogForm({ ...logForm, response: e.target.value })}
                placeholder="e.g. Shop owner was busy. Scheduled follow up call tomorrow."
                rows={2}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm mt-2"
            >
              <Clock size={16} /> Save Interaction Log
            </button>
          </form>
        </div>
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
                center={tempMapLocation || [activeLead.location.latitude, activeLead.location.longitude]}
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
