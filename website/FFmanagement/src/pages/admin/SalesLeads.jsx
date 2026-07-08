import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getLeadsApi, getStaffApi } from '@/api/lead';
import { Phone, User, Plus, Search, Info, MapPin, Activity, ChevronDown, ChevronUp } from 'lucide-react';

const statusMap = {
  'New': { bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Contacted': { bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'Visit Scheduled': { bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  'Negotiating': { bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Onboarded': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Not Interested': { bg: 'bg-slate-50 text-slate-700 border-slate-200' }
};

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
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  const sortedLeads = [...leads].sort((a, b) => {
    switch (sortBy) {
      case 'oldest': 
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      case 'nameAsc': 
        return (a.shopName || '').localeCompare(b.shopName || '');
      case 'nameDesc': 
        return (b.shopName || '').localeCompare(a.shopName || '');
      case 'newest':
      default:
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
  });

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

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <span className="text-sm font-bold text-slate-800 whitespace-nowrap mr-2">Shop Leads ({leads.length})</span>
            
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/admin/leads/dashboard')}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold border border-indigo-200 transition-colors shadow-sm"
              >
                <Activity size={14} /> View Dashboard
              </button>
              <button
                onClick={() => navigate('/admin/leads/map')}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold border border-emerald-200 transition-colors shadow-sm"
              >
                <MapPin size={14} /> View Map
              </button>
            </div>

            <div className="flex gap-2 ml-auto lg:ml-4">
              {isSuperAdmin && (
                <button
                  onClick={() => navigate('/admin/leads/team')}
                  className="inline-flex items-center gap-1 py-1.5 px-3 text-xs bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-semibold border border-slate-200 transition-colors shadow-sm"
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

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <form onSubmit={handleSearch} className="flex relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search shop, owner, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400 text-slate-700 shadow-sm"
              />
              <button type="submit" className="hidden">Search</button>
            </form>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-40 py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none shadow-sm"
            >
              <option value="">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Visit Scheduled">Visit Scheduled</option>
              <option value="Negotiating">Negotiating</option>
              <option value="Onboarded">Onboarded</option>
              <option value="Not Interested">Not Interested</option>
            </select>

            {isSuperAdmin && (
              <select
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="w-full sm:w-40 py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none shadow-sm"
              >
                <option value="">All Reps</option>
                {staff.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-36 py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none shadow-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="nameAsc">Name A-Z</option>
              <option value="nameDesc">Name Z-A</option>
            </select>
          </div>
        </div>

        <div className="p-4 bg-slate-50/30 flex-1 h-[75vh] max-h-[800px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400">Loading shop leads...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-32">
              <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-600">No shop leads found</p>
              <p className="text-sm text-slate-400 mt-1">Try expanding filter choices or add a new lead to get started.</p>
            </div>
          ) : (
            <div className="p-1">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider bg-slate-50">
                      <th className="p-4 font-semibold">Shop Name</th>
                      <th className="p-4 font-semibold">Owner</th>
                      <th className="p-4 font-semibold">Phone</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Last Contacted</th>
                      <th className="p-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedLeads.map(lead => {
                      const sStyle = statusMap[lead.status] || statusMap['New'];
                      return (
                        <tr key={lead._id} className="hover:bg-slate-50/80 transition-colors bg-white">
                          <td className="p-4">
                            <span className="font-bold text-slate-800">{lead.shopName}</span>
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1.5"><User size={13} className="text-slate-400"/> {lead.ownerName || 'Unknown'}</div>
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400"/> {lead.phoneNumber || lead.ownerPhoneNumber || 'N/A'}</div>
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${sStyle.bg}`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-500">
                            {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => navigate(`/admin/leads/${lead._id}`)}
                              className="text-xs font-bold text-sky-600 bg-sky-50 hover:bg-sky-500 hover:text-white px-3 py-1.5 rounded-lg border border-sky-100 transition-all shadow-sm"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col gap-3">
                {sortedLeads.map(lead => {
                  const sStyle = statusMap[lead.status] || statusMap['New'];
                  const isExpanded = expandedLeadId === lead._id;
                  return (
                    <div key={lead._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition-all hover:border-sky-300">
                      <div 
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => setExpandedLeadId(isExpanded ? null : lead._id)}
                      >
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{lead.shopName}</h4>
                          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${sStyle.bg}`}>
                            {lead.status}
                          </span>
                        </div>
                        <div className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <User size={13} className="text-slate-400" />
                            <span>{lead.ownerName || 'Unknown Owner'}</span>
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Phone size={13} className="text-slate-400" />
                            <span>{lead.phoneNumber || lead.ownerPhoneNumber || 'N/A'}</span>
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-slate-100 flex items-center justify-center text-[8px]">📅</span>
                            <span>Last Contacted: {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : 'Never'}</span>
                          </p>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/leads/${lead._id}`);
                            }}
                            className="w-full mt-3 text-xs font-bold text-sky-600 bg-sky-50 hover:bg-sky-500 hover:text-white py-2 rounded-lg border border-sky-100 transition-all shadow-sm"
                          >
                            View Full Details
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
