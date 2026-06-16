import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  ToggleLeft, 
  ToggleRight, 
  Search, 
  Info, 
  Clock, 
  Zap, 
  Calendar,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  getAllIncentives, 
  createIncentive, 
  updateIncentive, 
  toggleIncentive, 
  deleteIncentive 
} from '@/api/incentives';
import toast from 'react-hot-toast';

const IncentiveManagement = () => {
  const [incentives, setIncentives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncentive, setEditingIncentive] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'daily',
    slabs: [{ minOrders: '', bonus: '' }],
    conditions: {
      maxCancellations: '',
      minLoginHours: '',
      activeTimeWindow: {
        startTime: '',
        endTime: ''
      }
    },
    effectiveFrom: '',
    effectiveTo: ''
  });

  useEffect(() => {
    fetchIncentives();
  }, []);

  const fetchIncentives = async () => {
    try {
      setLoading(true);
      const res = await getAllIncentives();
      if (res.success) {
        setIncentives(res.incentives);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to fetch incentives');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleIncentive(id);
      if (res.success) {
        toast.success(res.message);
        fetchIncentives();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this incentive?')) return;
    try {
      const res = await deleteIncentive(id);
      if (res.success) {
        toast.success('Incentive deleted successfully');
        fetchIncentives();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete incentive');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'daily',
      slabs: [{ minOrders: '', bonus: '' }],
      conditions: {
        maxCancellations: '',
        minLoginHours: '',
        activeTimeWindow: {
          startTime: '',
          endTime: ''
        }
      },
      effectiveFrom: '',
      effectiveTo: ''
    });
    setEditingIncentive(null);
  };

  const handleOpenModal = (incentive = null) => {
    if (incentive) {
      setEditingIncentive(incentive);
      setFormData({
        name: incentive.name,
        description: incentive.description || '',
        type: incentive.type,
        slabs: incentive.slabs.map(s => ({ minOrders: s.minOrders, bonus: s.bonus })),
        conditions: {
          maxCancellations: incentive.conditions?.maxCancellations || '',
          minLoginHours: incentive.conditions?.minLoginHours || '',
          activeTimeWindow: {
            startTime: incentive.conditions?.activeTimeWindow?.startTime || '',
            endTime: incentive.conditions?.activeTimeWindow?.endTime || ''
          }
        },
        effectiveFrom: incentive.effectiveFrom ? new Date(incentive.effectiveFrom).toISOString().split('T')[0] : '',
        effectiveTo: incentive.effectiveTo ? new Date(incentive.effectiveTo).toISOString().split('T')[0] : ''
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clean data before sending
    const payload = { ...formData };
    payload.slabs = payload.slabs.map(s => ({ 
      minOrders: parseInt(s.minOrders), 
      bonus: parseInt(s.bonus) 
    }));
    
    if (payload.conditions.maxCancellations === '') delete payload.conditions.maxCancellations;
    else payload.conditions.maxCancellations = parseInt(payload.conditions.maxCancellations);
    
    if (payload.conditions.minLoginHours === '') delete payload.conditions.minLoginHours;
    else payload.conditions.minLoginHours = parseFloat(payload.conditions.minLoginHours);
    
    if (!payload.conditions.activeTimeWindow.startTime || !payload.conditions.activeTimeWindow.endTime) {
      delete payload.conditions.activeTimeWindow;
    }

    if (!payload.effectiveTo) delete payload.effectiveTo;

    try {
      let res;
      if (editingIncentive) {
        res = await updateIncentive(editingIncentive._id, payload);
      } else {
        res = await createIncentive(payload);
      }

      if (res.success) {
        toast.success(editingIncentive ? 'Incentive updated' : 'Incentive created');
        setIsModalOpen(false);
        fetchIncentives();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save incentive');
    }
  };

  const handleAddSlab = () => {
    setFormData({
      ...formData,
      slabs: [...formData.slabs, { minOrders: '', bonus: '' }]
    });
  };

  const handleRemoveSlab = (index) => {
    const newSlabs = [...formData.slabs];
    newSlabs.splice(index, 1);
    setFormData({ ...formData, slabs: newSlabs });
  };

  const handleSlabChange = (index, field, value) => {
    const newSlabs = [...formData.slabs];
    newSlabs[index][field] = value;
    setFormData({ ...formData, slabs: newSlabs });
  };

  const filteredIncentives = incentives.filter(inc => 
    inc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inc.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to get Monday and Sunday of the current/target week
  const getWeekBounds = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return {
      monday: monday.toISOString().split('T')[0],
      sunday: sunday.toISOString().split('T')[0]
    };
  };

  // Auto-suggest dates when type changes to weekly
  useEffect(() => {
    if (formData.type === 'weekly' && !editingIncentive && !formData.effectiveFrom) {
      const { monday, sunday } = getWeekBounds();
      setFormData(prev => ({
        ...prev,
        effectiveFrom: monday,
        effectiveTo: sunday
      }));
    }
  }, [formData.type, editingIncentive]);

  const handleSyncToWeek = () => {
    const baseDate = formData.effectiveFrom ? new Date(formData.effectiveFrom) : new Date();
    const { monday, sunday } = getWeekBounds(baseDate);
    setFormData({
      ...formData,
      effectiveFrom: monday,
      effectiveTo: sunday
    });
    toast.success('Dates synced to Monday-Sunday cycle');
  };

  const isMonday = (dateStr) => {
    if (!dateStr) return true;
    return new Date(dateStr).getDay() === 1;
  };

  const isSunday = (dateStr) => {
    if (!dateStr) return true;
    return new Date(dateStr).getDay() === 0;
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rider Incentives</h1>
          <p className="text-slate-500 text-sm mt-1">Manage daily and weekly incentive programs for delivery partners.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm shadow-sky-200 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create Program
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Active Programs</p>
            <p className="text-2xl font-bold text-slate-800">{incentives.filter(i => i.isActive).length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Daily Plans</p>
            <p className="text-2xl font-bold text-slate-800">{incentives.filter(i => i.type === 'daily').length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Weekly Plans</p>
            <p className="text-2xl font-bold text-slate-800">{incentives.filter(i => i.type === 'weekly').length}</p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or type..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Program Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Slabs</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Validity</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="6" className="px-6 py-4">
                      <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredIncentives.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Info className="w-10 h-10 opacity-20" />
                      <p>No incentive programs found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncentives.map((inc) => (
                  <tr key={inc._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{inc.name}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{inc.description || 'No description'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        inc.type === 'daily' ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {inc.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {inc.slabs.slice(0, 2).map((slab, i) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {slab.minOrders}+ Orders: ₹{slab.bonus}
                          </span>
                        ))}
                        {inc.slabs.length > 2 && (
                          <span className="text-[10px] text-slate-400">+{inc.slabs.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggle(inc._id)}
                        className={`transition-all ${inc.isActive ? 'text-emerald-500' : 'text-slate-300'}`}
                      >
                        {inc.isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(inc.effectiveFrom).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {inc.effectiveTo ? `Ends: ${new Date(inc.effectiveTo).toLocaleDateString()}` : 'Indefinite'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(inc)}
                          className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(inc._id)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-8 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {editingIncentive ? 'Edit Incentive Program' : 'New Incentive Program'}
                </h2>
                {formData.type === 'weekly' && (
                   <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                     <AlertCircle className="w-3 h-3" />
                     Recommended: Set dates to a Monday-Sunday cycle.
                   </p>
                )}
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto space-y-8 scrollbar-hide">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sky-600 font-bold text-sm border-b border-sky-100 pb-2">
                  <Info className="w-4 h-4" /> BASIC CONFIGURATION
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Program Name *</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Monsoon Bonus"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type *</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-bold"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="daily">Daily Program</option>
                      <option value="weekly">Weekly Program</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                  <textarea 
                    placeholder="Short description for riders..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all h-20 resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              {/* Slabs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-amber-600 font-bold text-sm border-b border-amber-100 pb-2">
                  <div className="flex items-center gap-2"><Zap className="w-4 h-4" /> REWARD SLABS</div>
                  <button 
                    type="button"
                    onClick={handleAddSlab}
                    className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg transition-all"
                  >
                    + ADD SLAB
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.slabs.map((slab, index) => (
                    <div key={index} className="flex items-end gap-3 animate-in slide-in-from-right-2 duration-200">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Min Orders</label>
                        <input 
                          required
                          type="number" 
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          value={slab.minOrders}
                          onChange={(e) => handleSlabChange(index, 'minOrders', e.target.value)}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Bonus Amount (₹)</label>
                        <input 
                          required
                          type="number" 
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          value={slab.bonus}
                          onChange={(e) => handleSlabChange(index, 'bonus', e.target.value)}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleRemoveSlab(index)}
                        disabled={formData.slabs.length === 1}
                        className="p-2 text-slate-300 hover:text-rose-500 disabled:opacity-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm border-b border-emerald-100 pb-2">
                  <CheckCircle2 className="w-4 h-4" /> QUALIFICATION RULES
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Cancellations Allowed</label>
                    <input 
                      type="number" 
                      placeholder="Optional"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={formData.conditions.maxCancellations}
                      onChange={(e) => setFormData({
                        ...formData, 
                        conditions: { ...formData.conditions, maxCancellations: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Min Login Hours Required</label>
                    <input 
                      type="number" 
                      step="0.5"
                      placeholder="Optional"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={formData.conditions.minLoginHours}
                      onChange={(e) => setFormData({
                        ...formData, 
                        conditions: { ...formData.conditions, minLoginHours: e.target.value }
                      })}
                    />
                  </div>
                </div>
                
                {formData.type === 'daily' && (
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Active Peak Window (Optional)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400">Start Time (e.g. 11:00)</label>
                        <input 
                          type="text" 
                          placeholder="HH:mm"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          value={formData.conditions.activeTimeWindow.startTime}
                          onChange={(e) => setFormData({
                            ...formData,
                            conditions: {
                              ...formData.conditions,
                              activeTimeWindow: { ...formData.conditions.activeTimeWindow, startTime: e.target.value }
                            }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400">End Time (e.g. 15:00)</label>
                        <input 
                          type="text" 
                          placeholder="HH:mm"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          value={formData.conditions.activeTimeWindow.endTime}
                          onChange={(e) => setFormData({
                            ...formData,
                            conditions: {
                              ...formData.conditions,
                              activeTimeWindow: { ...formData.conditions.activeTimeWindow, endTime: e.target.value }
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-slate-600 font-bold text-sm border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> PROGRAM VALIDITY</div>
                  {formData.type === 'weekly' && (
                    <button 
                      type="button"
                      onClick={handleSyncToWeek}
                      className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded-lg hover:bg-slate-700 transition-all flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" /> SYNC TO WEEKLY CYCLE
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      Start Date *
                      {formData.type === 'weekly' && !isMonday(formData.effectiveFrom) && (
                        <span className="text-[9px] text-rose-500 lowercase font-normal flex items-center gap-0.5">
                          <AlertCircle className="w-2 h-2" /> not a monday
                        </span>
                      )}
                    </label>
                    <input 
                      required
                      type="date" 
                      className={`w-full px-4 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 transition-all ${
                        formData.type === 'weekly' && !isMonday(formData.effectiveFrom) 
                        ? 'border-rose-200 focus:ring-rose-500/20 focus:border-rose-500' 
                        : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                      value={formData.effectiveFrom}
                      onChange={(e) => setFormData({...formData, effectiveFrom: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      End Date (Optional)
                      {formData.type === 'weekly' && formData.effectiveTo && !isSunday(formData.effectiveTo) && (
                        <span className="text-[9px] text-rose-500 lowercase font-normal flex items-center gap-0.5">
                          <AlertCircle className="w-2 h-2" /> not a sunday
                        </span>
                      )}
                    </label>
                    <input 
                      type="date" 
                      className={`w-full px-4 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 transition-all ${
                        formData.type === 'weekly' && formData.effectiveTo && !isSunday(formData.effectiveTo) 
                        ? 'border-rose-200 focus:ring-rose-500/20 focus:border-rose-500' 
                        : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-500'
                      }`}
                      value={formData.effectiveTo}
                      onChange={(e) => setFormData({...formData, effectiveTo: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95"
                >
                  {editingIncentive ? 'Save Changes' : 'Create Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncentiveManagement;
