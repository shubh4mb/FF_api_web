import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Search, 
  Calendar, 
  Filter, 
  Eye, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  PlayCircle,
  TrendingUp,
  Download,
  X
} from 'lucide-react';
import { getPayouts, triggerPayout, markPayoutPaid } from '@/api/payouts';
import toast from 'react-hot-toast';

const PayoutManagement = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState(false);

  // Mark as Paid Modal State
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [adminDeductionAmount, setAdminDeductionAmount] = useState('');
  const [adminDeductionReason, setAdminDeductionReason] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const res = await getPayouts();
      if (res.success) {
        setPayouts(res.payouts);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to fetch payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerPayout = async () => {
    if (!window.confirm('This will finalize all accumulating weekly payouts (closing the cycle). Proceed?')) return;
    try {
      setProcessing(true);
      const res = await triggerPayout();
      if (res.successCount > 0 || res.failCount > 0) {
        toast.success(`Processed ${res.successCount} payouts successfully. ${res.failCount} failed.`);
        fetchPayouts();
      } else {
        toast.info('No pending payouts to process.');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to trigger payout processing');
    } finally {
      setProcessing(false);
    }
  };

  const openMarkPaidModal = (payout) => {
    setSelectedPayout(payout);
    setAdminDeductionAmount('');
    setAdminDeductionReason('');
    setIsMarkPaidModalOpen(true);
  };

  const submitMarkPaid = async () => {
    if (!selectedPayout) return;
    try {
      setSubmittingPayment(true);
      const payload = {};
      if (adminDeductionAmount && parseFloat(adminDeductionAmount) > 0) {
        payload.adminDeductionAmount = parseFloat(adminDeductionAmount);
        payload.adminDeductionReason = adminDeductionReason;
        if (!payload.adminDeductionReason) {
          toast.error("Reason is required for deduction.");
          setSubmittingPayment(false);
          return;
        }
      }

      const res = await markPayoutPaid(selectedPayout._id, payload);
      if (res.success) {
        toast.success('Payout marked as paid!');
        setIsMarkPaidModalOpen(false);
        fetchPayouts();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to mark as paid');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filteredPayouts = payouts.filter(p => {
    const matchesSearch = p.ownerId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.ownerType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPayout = filteredPayouts.reduce((sum, p) => sum + (p.finalAmount || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Paid</span>;
      case 'finalized':
        return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" /> Pending Approval</span>;
      case 'accumulating':
        return <span className="bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending</span>;
      case 'failed':
        return <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" /> Failed</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weekly Payouts</h1>
          <p className="text-slate-500 text-sm mt-1">Monitor and process payouts for riders and merchants.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold transition-all"
            onClick={() => {/* Export Logic */}}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={handleTriggerPayout}
            disabled={processing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg active:scale-95"
          >
            {processing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
            Process Payouts
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Total Payout Vol.</p>
          <p className="text-2xl font-black text-slate-800">₹{totalPayout.toLocaleString()}</p>
          <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold mt-2">
            <TrendingUp className="w-3 h-3" /> +12.5% vs last week
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Pending Payouts</p>
          <p className="text-2xl font-black text-slate-800">{payouts.filter(p => p.status === 'accumulating').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Total Incentives</p>
          <p className="text-2xl font-black text-emerald-600">₹{payouts.reduce((sum, p) => sum + (p.totalIncentive || 0), 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Settled This Month</p>
          <p className="text-2xl font-black text-slate-800">{payouts.filter(p => p.status === 'paid').length}</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search ID or type..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="bg-white border border-slate-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="finalized">Pending Approval</option>
              <option value="paid">Paid</option>
              <option value="accumulating">Accumulating</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Cycle Period</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Earnings</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Incentives</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Net Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="7" className="px-6 py-4">
                      <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-20 text-center text-slate-400">
                    <p>No payout records found.</p>
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-medium text-slate-700">
                          {new Date(p.weekStart).toLocaleDateString()} - {new Date(p.weekEnd).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${p.ownerType === 'rider' ? 'bg-sky-400' : 'bg-amber-400'}`}></div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tighter">{p.ownerType}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">{p.ownerId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-slate-700">₹{p.totalEarnings.toLocaleString()}</div>
                      <div className="text-[10px] text-rose-500">-{p.totalDeductions.toLocaleString()} ded.</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-emerald-600">+₹{p.totalIncentive.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{p.incentivesEarned?.length || 0} programs</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-black text-slate-800">₹{p.finalAmount?.toLocaleString() || p.netPayout.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(p.status)}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      {p.status === 'finalized' && (
                        <button 
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                          onClick={() => openMarkPaidModal(p)}
                          title="Mark as Paid"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button 
                        className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-all"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Paid Modal */}
      {isMarkPaidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Process Payment</h3>
              <button 
                onClick={() => setIsMarkPaidModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-sky-50 rounded-xl border border-sky-100 mb-6">
                <p className="text-xs text-sky-800 font-medium leading-relaxed">
                  You are about to mark this payout as paid. Please ensure the bank transfer has been successfully completed.
                </p>
                <p className="text-sm font-black text-sky-900 mt-2">
                  Amount: ₹{selectedPayout?.finalAmount?.toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Admin Deduction (Optional)</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
                    <input 
                      type="number"
                      value={adminDeductionAmount}
                      onChange={(e) => setAdminDeductionAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-medium"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Leave empty if no deduction is needed.</p>
                </label>

                <label className="block">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Reason for Deduction</span>
                  <textarea 
                    value={adminDeductionReason}
                    onChange={(e) => setAdminDeductionReason(e.target.value)}
                    placeholder="e.g. Late penalty, missing items..."
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all min-h-[80px] resize-none"
                    required={parseFloat(adminDeductionAmount) > 0}
                  ></textarea>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50/50">
              <button 
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-all"
                onClick={() => setIsMarkPaidModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                onClick={submitMarkPaid}
                disabled={submittingPayment}
              >
                {submittingPayment ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutManagement;
