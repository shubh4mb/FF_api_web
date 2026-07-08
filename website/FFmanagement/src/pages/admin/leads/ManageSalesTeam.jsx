import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getStaffApi, registerStaffApi } from '@/api/lead';
import { ArrowLeft, Users } from 'lucide-react';

export default function ManageSalesTeam() {
  const navigate = useNavigate();
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const isSuperAdmin = adminUser.role === 'superadmin';

  const [staff, setStaff] = useState([]);
  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    role: 'sales'
  });

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
    if (!isSuperAdmin) {
      toast.error('Unauthorized access');
      navigate('/admin/leads');
      return;
    }
    loadStaff();
  }, [isSuperAdmin, navigate]);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!teamForm.name || !teamForm.email || !teamForm.password) {
      toast.error('Name, email and password are required');
      return;
    }
    setSubmittingTeam(true);
    try {
      const res = await registerStaffApi(teamForm);
      if (res) {
        toast.success('Staff account created successfully');
        setTeamForm({ name: '', email: '', phoneNumber: '', password: '', role: 'sales' });
        loadStaff();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to register team member');
    } finally {
      setSubmittingTeam(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate('/admin/leads')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Manage Sales Team</h2>
          <p className="text-sm text-slate-500">View current members and add new representatives</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Current Team List */}
        <div className="lg:col-span-2 flex flex-col border border-slate-200 rounded-2xl p-6 bg-white shadow-sm h-[600px]">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Users className="text-sky-500" size={20} />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Active Staff ({staff.length})</h4>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
            {staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-sm text-slate-500 font-medium">No staff members found.</p>
                <p className="text-xs text-slate-400 mt-1">Register a representative to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.map(s => (
                  <div key={s._id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all hover:shadow-md flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-slate-800">{s.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${s.role === 'sales' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                        {s.role === 'sales' ? 'Sales Rep' : 'Super Admin'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{s.email}</span>
                    {s.phoneNumber && <span className="text-xs text-slate-500">{s.phoneNumber}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Add Member Form */}
        <div className="flex flex-col border border-slate-200 rounded-2xl p-6 bg-slate-50 shadow-sm">
          <h4 className="text-sm font-bold text-slate-800 uppercase mb-5 shrink-0">Register New Staff</h4>
          
          <form onSubmit={handleCreateStaff} className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="e.g. David Miller"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email Address *</label>
              <input
                type="email"
                required
                value={teamForm.email}
                onChange={(e) => setTeamForm({ ...teamForm, email: e.target.value })}
                placeholder="e.g. david@flashfits.com"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Phone Number</label>
              <input
                type="text"
                value={teamForm.phoneNumber}
                onChange={(e) => setTeamForm({ ...teamForm, phoneNumber: e.target.value })}
                placeholder="e.g. +91..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Account Role *</label>
              <select
                value={teamForm.role}
                onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white"
              >
                <option value="sales">Sales Representative</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Initial Password *</label>
              <input
                type="password"
                required
                value={teamForm.password}
                onChange={(e) => setTeamForm({ ...teamForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submittingTeam}
              className="w-full py-3 mt-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {submittingTeam ? 'Registering...' : 'Register Representative'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
