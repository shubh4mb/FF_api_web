import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLeadsApi } from '@/api/lead';
import { ArrowLeft, Activity, Target, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function LeadsDashboard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await getLeadsApi({});
        setLeads(res || []);
      } catch (error) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  const statCounts = {
    Total: leads.length,
    New: leads.filter(l => l.status === 'New').length,
    Contacted: leads.filter(l => l.status === 'Contacted').length,
    VisitScheduled: leads.filter(l => l.status === 'Visit Scheduled').length,
    Negotiating: leads.filter(l => l.status === 'Negotiating').length,
    Onboarded: leads.filter(l => l.status === 'Onboarded').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[500px]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/leads')}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Sales Dashboard</h1>
            <p className="text-sm text-slate-500">Overview of your sales pipeline and conversions</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Leads Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
              <Activity className="w-6 h-6" />
            </div>
            <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full">All Time</span>
          </div>
          <div className="mt-6">
            <h2 className="text-5xl font-black text-slate-800">{statCounts.Total}</h2>
            <p className="text-slate-500 font-semibold mt-1">Total Shop Leads</p>
          </div>
        </div>

        {/* Onboarded Card */}
        <div className="bg-emerald-500 p-6 rounded-3xl border border-emerald-600 shadow-sm flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-10 rounded-full blur-xl"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-6 relative z-10">
            <h2 className="text-5xl font-black">{statCounts.Onboarded}</h2>
            <p className="text-emerald-100 font-semibold mt-1">Successfully Onboarded</p>
          </div>
        </div>

        {/* Action Required Breakdown */}
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-900 shadow-sm flex flex-col text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-slate-700 p-2.5 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="font-bold">Pipeline Status</h3>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <span className="text-slate-400 font-medium">New Leads</span>
              <span className="text-xl font-bold">{statCounts.New}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <span className="text-slate-400 font-medium">Contacted</span>
              <span className="text-xl font-bold">{statCounts.Contacted}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <span className="text-slate-400 font-medium">Visits Scheduled</span>
              <span className="text-xl font-bold">{statCounts.VisitScheduled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Negotiating</span>
              <span className="text-xl font-bold">{statCounts.Negotiating}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
