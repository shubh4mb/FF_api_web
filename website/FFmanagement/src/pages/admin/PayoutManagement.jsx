import React, { useState, useEffect, useRef } from 'react';
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
  X,
  Copy,
  Check,
  Upload,
  CreditCard,
  Building2,
  Store,
  Bike,
  FileText,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Image as ImageIcon
} from 'lucide-react';
import { getPayouts, triggerPayout, markPayoutPaid } from '@/api/payouts';
import toast from 'react-hot-toast';

const PayoutManagement = () => {
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'all', 'pending', 'merchants', 'riders', 'paid'
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('all');
  const [processing, setProcessing] = useState(false);

  // Mark as Paid Modal State
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState('input'); // 'input' | 'confirm'
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [adminDeductionAmount, setAdminDeductionAmount] = useState('');
  const [adminDeductionReason, setAdminDeductionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // View Receipt Modal State
  const [viewReceiptModalOpen, setViewReceiptModalOpen] = useState(false);
  const [activeReceiptUrl, setActiveReceiptUrl] = useState(null);
  const [activeReceiptTitle, setActiveReceiptTitle] = useState('');

  // Copied helper
  const [copiedText, setCopiedText] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPayouts();
  }, [ownerTypeFilter, statusFilter]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (ownerTypeFilter !== 'all') params.type = ownerTypeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await getPayouts(params);
      if (res.success) {
        setPayouts(res.payouts || []);
        if (res.summary) setSummary(res.summary);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to fetch payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPayouts();
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`Copied ${label || 'to clipboard'}`);
    setTimeout(() => setCopiedText(null), 2000);
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
    setPaymentMethod(payout.ownerDetails?.upiId ? 'upi' : 'bank_transfer');
    setReferenceNumber('');
    setReceiptFile(null);
    setReceiptPreview(null);
    setAdminDeductionAmount('');
    setAdminDeductionReason('');
    setNotes('');
    setModalStep('input');
    setIsMarkPaidModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG, JPG, JPEG)');
        return;
      }
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = () => setReceiptPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openReceiptViewer = (url, title) => {
    setActiveReceiptUrl(url);
    setActiveReceiptTitle(title || 'Payment Receipt / Bill Proof');
    setViewReceiptModalOpen(true);
  };

  const handleProceedToConfirm = () => {
    if (adminDeductionAmount && parseFloat(adminDeductionAmount) > 0 && !adminDeductionReason) {
      toast.error('Please specify a reason for the admin deduction.');
      return;
    }
    setModalStep('confirm');
  };

  const submitMarkPaid = async () => {
    if (!selectedPayout) return;
    try {
      setSubmittingPayment(true);

      const formData = new FormData();
      formData.append('paymentMethod', paymentMethod);
      if (referenceNumber) formData.append('referenceNumber', referenceNumber.trim());
      if (notes) formData.append('notes', notes.trim());
      
      if (adminDeductionAmount && parseFloat(adminDeductionAmount) > 0) {
        formData.append('adminDeductionAmount', parseFloat(adminDeductionAmount));
        formData.append('adminDeductionReason', adminDeductionReason);
      }

      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      const res = await markPayoutPaid(selectedPayout._id, formData);
      if (res.success) {
        toast.success('Payout marked as paid and transaction logged!');
        setIsMarkPaidModalOpen(false);
        fetchPayouts();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to mark as paid');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Filter payouts based on tab and client search
  const filteredPayouts = payouts.filter((p) => {
    if (activeTab === 'pending') {
      if (p.status !== 'finalized') return false;
    } else if (activeTab === 'merchants') {
      if (p.ownerType !== 'merchant') return false;
    } else if (activeTab === 'riders') {
      if (p.ownerType !== 'rider') return false;
    } else if (activeTab === 'paid') {
      if (p.status !== 'paid') return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const ownerName = (p.ownerDetails?.name || '').toLowerCase();
    const shopName = (p.ownerDetails?.shopName || '').toLowerCase();
    const email = (p.ownerDetails?.email || '').toLowerCase();
    const phone = (p.ownerDetails?.phone || '').toLowerCase();
    const ownerId = (p.ownerId || '').toLowerCase();
    const ref = (p.referenceNumber || '').toLowerCase();

    return (
      ownerName.includes(term) ||
      shopName.includes(term) ||
      email.includes(term) ||
      phone.includes(term) ||
      ownerId.includes(term) ||
      ref.includes(term)
    );
  });

  const pendingCount = payouts.filter(p => p.status === 'finalized').length;
  const totalVolume = payouts.reduce((sum, p) => sum + (p.finalAmount || p.netPayout || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase flex items-center gap-1 w-fit border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Paid
          </span>
        );
      case 'finalized':
        return (
          <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase flex items-center gap-1 w-fit border border-amber-300 animate-pulse">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Action Required (Pending Pay)
          </span>
        );
      case 'accumulating':
        return (
          <span className="bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase flex items-center gap-1 w-fit border border-sky-200">
            <Clock className="w-3 h-3 text-sky-600" /> Accumulating
          </span>
        );
      case 'failed':
        return (
          <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase flex items-center gap-1 w-fit border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase flex items-center gap-1 w-fit border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getNetPayable = (payout) => {
    if (!payout) return 0;
    const base = payout.finalAmount !== undefined ? payout.finalAmount : (payout.netPayout || 0);
    const deduction = parseFloat(adminDeductionAmount) || 0;
    return Math.max(0, base - deduction);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Weekly Payouts & Settlements</h1>
            {pendingCount > 0 && (
              <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm animate-bounce">
                {pendingCount} Pending Pay
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Review weekly accumulated earnings, execute manual payouts to merchants & riders, and attach official receipt proof.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchPayouts}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold transition-all text-sm"
          >
            Refresh
          </button>
          <button 
            onClick={handleTriggerPayout}
            disabled={processing}
            className="flex items-center gap-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md active:scale-95 text-sm"
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <PlayCircle className="w-4 h-4" />
            )}
            Process Weekly Cycle
          </button>
        </div>
      </div>

      {/* ── OVERVIEW STAT CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Volume</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₹{totalVolume.toLocaleString()}</p>
            </div>
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 font-medium">All recorded cycles</div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm transition-all ${pendingCount > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-800 text-xs font-semibold uppercase tracking-wider">Action Required</p>
              <p className="text-2xl font-black text-amber-900 mt-1">{pendingCount}</p>
            </div>
            <div className={`p-2.5 rounded-xl ${pendingCount > 0 ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-amber-700 mt-3 font-medium">Finalized cycles awaiting manual bank transfer</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Settled & Paid</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {payouts.filter(p => p.status === 'paid').length}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-medium">Transferred with proof attached</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Incentives</p>
              <p className="text-2xl font-black text-sky-600 mt-1">
                ₹{payouts.reduce((sum, p) => sum + (p.totalIncentive || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 bg-sky-50 rounded-xl text-sky-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 font-medium">Rider bonuses disbursed</p>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 px-4 pt-3 gap-2 overflow-x-auto">
          {[
            { id: 'pending', label: 'Action Required', count: pendingCount, highlight: true },
            { id: 'all', label: 'All Payouts', count: payouts.length },
            { id: 'merchants', label: 'Merchants', count: payouts.filter(p => p.ownerType === 'merchant').length },
            { id: 'riders', label: 'Riders', count: payouts.filter(p => p.ownerType === 'rider').length },
            { id: 'paid', label: 'Paid History', count: payouts.filter(p => p.status === 'paid').length },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-slate-900 bg-white text-slate-900 shadow-sm'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tab.highlight && tab.count > 0
                        ? 'bg-amber-200 text-amber-900'
                        : isActive
                        ? 'bg-slate-100 text-slate-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Secondary Filter controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
          <form onSubmit={handleSearch} className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search shop, name, email, or UTR..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="finalized">Pending Approval / Pay</option>
              <option value="paid">Paid</option>
              <option value="accumulating">Accumulating</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* ── PAYOUTS TABLE ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/80">
                <th className="px-6 py-3.5">Cycle Period</th>
                <th className="px-6 py-3.5">Beneficiary / Recipient</th>
                <th className="px-6 py-3.5">Bank / UPI Destination</th>
                <th className="px-6 py-3.5">Gross / Deductions</th>
                <th className="px-6 py-3.5">Net Payout</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="7" className="px-6 py-4">
                      <div className="h-8 bg-slate-100 rounded-lg w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <ShieldCheck className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No payout records found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {activeTab === 'pending'
                          ? 'All finalized payouts have been processed and paid! 🎉'
                          : 'Try adjusting your search or filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((p) => {
                  const owner = p.ownerDetails;
                  const isMerchant = p.ownerType === 'merchant';
                  const displayAmount = p.finalAmount !== undefined ? p.finalAmount : p.netPayout;
                  const hasReceipt = Boolean(p.receipt?.url);

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Cycle Period */}
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-xs font-semibold text-slate-800">
                            {new Date(p.weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} -{' '}
                            {new Date(p.weekEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          Cycle ID: {p._id.slice(-6)}
                        </div>
                      </td>

                      {/* Recipient */}
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isMerchant ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {isMerchant ? <Store className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                            {p.ownerType}
                          </span>
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[150px]">
                            {owner?.shopName || owner?.name || 'Unknown Owner'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 truncate max-w-[190px]">
                          {owner?.email || 'No email'}
                        </div>
                        {owner?.phone && (
                          <div className="text-[11px] text-slate-400 font-medium">{owner.phone}</div>
                        )}
                      </td>

                      {/* Bank / UPI Destination */}
                      <td className="px-6 py-4 align-top">
                        {owner?.bankDetails ? (
                          <div className="space-y-1 max-w-[200px]">
                            {owner.bankDetails.bankName && (
                              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{owner.bankDetails.bankName}</span>
                              </div>
                            )}
                            {owner.bankDetails.accountNumber && (
                              <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5">
                                <span>A/C: {owner.bankDetails.accountNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(owner.bankDetails.accountNumber, 'Account Number')}
                                  className="text-slate-400 hover:text-slate-700"
                                  title="Copy Account Number"
                                >
                                  {copiedText === owner.bankDetails.accountNumber ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                            {owner.bankDetails.ifscCode && (
                              <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                                <span>IFSC: {owner.bankDetails.ifscCode}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(owner.bankDetails.ifscCode, 'IFSC Code')}
                                  className="text-slate-400 hover:text-slate-700"
                                  title="Copy IFSC"
                                >
                                  {copiedText === owner.bankDetails.ifscCode ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                            {owner.bankDetails.upiId && (
                              <div className="text-[11px] font-medium text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit">
                                <span>UPI: {owner.bankDetails.upiId}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(owner.bankDetails.upiId, 'UPI ID')}
                                  className="text-emerald-700 hover:text-emerald-900"
                                  title="Copy UPI ID"
                                >
                                  {copiedText === owner.bankDetails.upiId ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                            Bank details missing
                          </span>
                        )}
                      </td>

                      {/* Gross / Deductions */}
                      <td className="px-6 py-4 align-top">
                        <div className="text-xs font-semibold text-slate-700">
                          ₹{(p.totalGrossSales || p.totalEarnings || 0).toLocaleString()}
                        </div>
                        {p.totalCommission > 0 && (
                          <div className="text-[10px] text-slate-500">
                            -₹{p.totalCommission.toLocaleString()} (4% comm.)
                          </div>
                        )}
                        {p.totalDeductions > 0 && (
                          <div className="text-[10px] text-rose-500 font-medium">
                            -₹{p.totalDeductions.toLocaleString()} ded.
                          </div>
                        )}
                        {p.totalIncentive > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            +₹{p.totalIncentive.toLocaleString()} bonus
                          </div>
                        )}
                      </td>

                      {/* Net Payout */}
                      <td className="px-6 py-4 align-top">
                        <div className="text-base font-black text-slate-900">
                          ₹{displayAmount.toLocaleString()}
                        </div>
                        {p.paidAt && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Paid {new Date(p.paidAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                        {p.referenceNumber && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <span>Ref: {p.referenceNumber}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(p.referenceNumber, 'Reference Number')}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 align-top">{getStatusBadge(p.status)}</td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right align-top">
                        <div className="flex items-center justify-end gap-2">
                          {p.status === 'finalized' && (
                            <button 
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                              onClick={() => openMarkPaidModal(p)}
                              title="Process manual payment and upload proof"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Pay Now
                            </button>
                          )}

                          {hasReceipt && (
                            <button
                              onClick={() => openReceiptViewer(p.receipt.url, `Receipt for ${owner?.shopName || owner?.name || 'Payout'}`)}
                              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
                              title="View Payment Receipt / Bill"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: PROCESS PAYMENT & MARK AS PAID ── */}
      {isMarkPaidModalOpen && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {modalStep === 'input' ? 'Process Manual Payment' : 'Confirm Payment & Receipt'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {modalStep === 'input' ? 'Step 1 of 2: Enter payment details & bill receipt' : 'Step 2 of 2: Review and finalize'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsMarkPaidModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: INPUT DETAILS */}
            {modalStep === 'input' && (
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Beneficiary & Amount Summary Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Beneficiary</span>
                      <p className="text-sm font-bold text-slate-900">
                        {selectedPayout.ownerDetails?.shopName || selectedPayout.ownerDetails?.name || 'Recipient'}
                      </p>
                      <p className="text-xs text-slate-500">{selectedPayout.ownerDetails?.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payable Amount</span>
                      <p className="text-xl font-black text-emerald-600">
                        ₹{getNetPayable(selectedPayout).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Bank info preview */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                    <p className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      Destination Account Details:
                    </p>
                    {selectedPayout.ownerDetails?.bankDetails ? (
                      <>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Bank: {selectedPayout.ownerDetails.bankDetails.bankName || 'N/A'}</span>
                          <span className="font-mono">A/C: {selectedPayout.ownerDetails.bankDetails.accountNumber}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-mono">IFSC: {selectedPayout.ownerDetails.bankDetails.ifscCode}</span>
                          {selectedPayout.ownerDetails.bankDetails.upiId && (
                            <span className="text-emerald-700 font-semibold">
                              UPI: {selectedPayout.ownerDetails.bankDetails.upiId}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-rose-500 font-medium">No verified bank details found for this beneficiary.</p>
                    )}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                    <option value="upi">UPI Transfer (GPay / PhonePe / Paytm)</option>
                    <option value="cash">Cash Settlement</option>
                    <option value="razorpay">Razorpay Gateway</option>
                    <option value="wallet">In-App Wallet Credit</option>
                    <option value="other">Other / Cheque</option>
                  </select>
                </div>

                {/* UTR / Reference Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    UTR / Bank Reference / Transaction ID
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UTR123456789 or UPI Ref ID"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Beneficiaries use this reference number to verify credits in their bank statement.
                  </p>
                </div>

                {/* Bill / Receipt Photo Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Proof / Receipt Photo
                  </label>
                  
                  {receiptPreview ? (
                    <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-slate-900/5 p-2">
                      <img 
                        src={receiptPreview} 
                        alt="Receipt preview" 
                        className="w-full h-44 object-contain rounded-xl bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        className="absolute top-4 right-4 bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded-full shadow-md transition-all"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-center text-xs font-semibold text-slate-700 mt-2">
                        {receiptFile?.name} ({Math.round((receiptFile?.size || 0) / 1024)} KB)
                      </p>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/70 p-5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group text-center"
                    >
                      <Upload className="w-7 h-7 text-slate-400 group-hover:text-slate-600 mb-2 transition-colors" />
                      <p className="text-xs font-bold text-slate-700">Click to upload transfer screenshot or receipt bill</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, or WEBP (Max 10MB)</p>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </div>
                  )}
                </div>

                {/* Deductions & Notes Accordion / Inputs */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Deduction (Optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                        <input
                          type="number"
                          value={adminDeductionAmount}
                          onChange={(e) => setAdminDeductionAmount(e.target.value)}
                          placeholder="0"
                          className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Deduction Reason
                      </label>
                      <input
                        type="text"
                        value={adminDeductionReason}
                        onChange={(e) => setAdminDeductionReason(e.target.value)}
                        placeholder="e.g. Damage penalty"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Internal Notes
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes for audit logs"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: CONFIRMATION VIEW */}
            {modalStep === 'confirm' && (
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Final Net Transfer Amount</span>
                  <p className="text-3xl font-black text-emerald-700">
                    ₹{getNetPayable(selectedPayout).toLocaleString()}
                  </p>
                  <p className="text-xs text-emerald-600">
                    Transferred via <span className="font-bold uppercase">{paymentMethod.replace('_', ' ')}</span>
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beneficiary:</span>
                    <span className="font-bold text-slate-800">
                      {selectedPayout.ownerDetails?.shopName || selectedPayout.ownerDetails?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reference / UTR:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {referenceNumber || 'None specified'}
                    </span>
                  </div>
                  {adminDeductionAmount && parseFloat(adminDeductionAmount) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Deduction ({adminDeductionReason}):</span>
                      <span className="font-bold">-₹{parseFloat(adminDeductionAmount).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Receipt confirmation preview */}
                {receiptPreview ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Attached Payment Receipt:
                    </span>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900/5 p-2">
                      <img 
                        src={receiptPreview} 
                        alt="Receipt preview" 
                        className="w-full h-44 object-contain rounded-xl bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                    ⚠️ No receipt photo attached. It is strongly recommended to upload payment proof for clear merchant records.
                  </div>
                )}

                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Upon confirmation, the status will update to <strong className="text-slate-700">PAID</strong>, a record will be added to the central Transaction Ledger, and the receipt photo will be visible to the beneficiary.
                </p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50/70">
              {modalStep === 'input' ? (
                <>
                  <button 
                    type="button"
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-xl transition-all"
                    onClick={() => setIsMarkPaidModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                    onClick={handleProceedToConfirm}
                  >
                    <span>Review & Confirm</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    disabled={submittingPayment}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-xl transition-all"
                    onClick={() => setModalStep('input')}
                  >
                    Back to Edit
                  </button>
                  <button 
                    type="button"
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    onClick={submitMarkPaid}
                    disabled={submittingPayment}
                  >
                    {submittingPayment ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Confirm & Mark as Paid
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FULLSCREEN RECEIPT VIEWER ── */}
      {viewReceiptModalOpen && activeReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-700">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">{activeReceiptTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={activeReceiptUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button 
                  onClick={() => setViewReceiptModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[350px] max-h-[70vh] overflow-auto">
              <img 
                src={activeReceiptUrl} 
                alt="Proof of Payment" 
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewReceiptModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutManagement;
