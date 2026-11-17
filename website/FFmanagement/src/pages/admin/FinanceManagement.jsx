import React, { useState, useEffect } from 'react';
import api from '../../utils/axios.config';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Users,
  PlusCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
  ChevronDown,
  X,
  CreditCard,
  UserCheck,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Paperclip,
  FileText,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const CATEGORIES = {
  EXPENSE: [
    'Inventory / Dresses',
    'T-Shirts / Merchandise',
    'Delivery Bags & Packaging',
    'Server & Tech Infra',
    'Marketing & Ads',
    'Rider & Delivery Ops',
    'Office & Rent',
    'Miscellaneous'
  ],
  INCOME: [
    'Orders & Sales',
    'Merchant Onboarding',
    'Partner Capital Contribution',
    'Refund / Recovery',
    'Other Income'
  ]
};

const PAYMENT_MODES = [
  'UPI',
  'Bank Transfer',
  'Cash',
  'Credit Card',
  'Debit Card',
  'FlashFits Account',
  'Other'
];

export default function FinanceManagement() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'entries' | 'partners'
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [partners, setPartners] = useState([]);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 1 });

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // Modal States
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);

  // New Entry Form State
  const [entryForm, setEntryForm] = useState({
    entryType: 'EXPENSE',
    title: '',
    category: 'Inventory / Dresses',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'UPI',
    paidByPartner: '', // empty means FlashFits / Company account
    isSplit: true,
    splitType: 'EQUAL', // 'EQUAL' or 'CUSTOM'
    selectedPartnerIds: [],
    customShares: {}, // { partnerId: shareAmount }
    notes: '',
  });

  // New Partner Form State
  const [partnerForm, setPartnerForm] = useState({
    name: '',
    phone: '',
    upiId: '',
    notes: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [filterType, filterCategory, pagination.page]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchPartners()]);
    } catch (err) {
      console.error('Error loading finance data', err);
      toast.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOverview = async () => {
    try {
      const params = {};
      if (dateFilter.start) params.startDate = dateFilter.start;
      if (dateFilter.end) params.endDate = dateFilter.end;
      const res = await api.get('/admin/finance/overview', { params });
      if (res.data?.success) {
        setOverview(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPartners = async () => {
    try {
      const res = await api.get('/admin/finance/partners');
      if (res.data?.success) {
        const fetched = res.data.data;
        setPartners(fetched);
        // Pre-select all active partners for default split
        setEntryForm((prev) => ({
          ...prev,
          selectedPartnerIds: fetched.map((p) => p._id)
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEntries = async () => {
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (filterType) params.entryType = filterType;
      if (filterCategory) params.category = filterCategory;
      if (searchQuery) params.search = searchQuery;
      if (dateFilter.start) params.startDate = dateFilter.start;
      if (dateFilter.end) params.endDate = dateFilter.end;

      const res = await api.get('/admin/finance/entries', { params });
      if (res.data?.success) {
        setEntries(res.data.data);
        if (res.data.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.data.pagination.total,
            totalPages: res.data.pagination.totalPages
          }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEntryModal = () => {
    setReceiptFile(null);
    setEntryForm({
      entryType: 'EXPENSE',
      title: '',
      category: 'Inventory / Dresses',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'UPI',
      paidByPartner: partners[0]?._id || '',
      isSplit: true,
      splitType: 'EQUAL',
      selectedPartnerIds: partners.map((p) => p._id),
      customShares: {},
      notes: ''
    });
    setIsEntryModalOpen(true);
  };

  const handlePartnerToggle = (partnerId) => {
    setEntryForm((prev) => {
      const exists = prev.selectedPartnerIds.includes(partnerId);
      const updated = exists
        ? prev.selectedPartnerIds.filter((id) => id !== partnerId)
        : [...prev.selectedPartnerIds, partnerId];
      return { ...prev, selectedPartnerIds: updated };
    });
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryForm.title.trim()) {
      return toast.error('Please enter a title');
    }
    const amt = Number(entryForm.amount);
    if (!amt || amt <= 0) {
      return toast.error('Please enter a valid amount');
    }

    if (entryForm.isSplit && entryForm.selectedPartnerIds.length === 0) {
      return toast.error('Select at least one partner for the split');
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('entryType', entryForm.entryType);
      formData.append('title', entryForm.title);
      formData.append('category', entryForm.category);
      formData.append('amount', String(amt));
      formData.append('date', entryForm.date);
      formData.append('paymentMode', entryForm.paymentMode);
      if (entryForm.paidByPartner) {
        formData.append('paidByPartner', entryForm.paidByPartner);
      }
      formData.append('isSplit', String(entryForm.isSplit));
      formData.append('splitType', entryForm.splitType);
      formData.append('notes', entryForm.notes || '');

      const splitPartnersData =
        entryForm.splitType === 'EQUAL'
          ? entryForm.selectedPartnerIds
          : entryForm.selectedPartnerIds.map((id) => ({
              partnerId: id,
              shareAmount: Number(entryForm.customShares[id]) || 0
            }));
      formData.append('splitPartners', JSON.stringify(splitPartnersData));

      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      const res = await api.post('/admin/finance/entries', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        toast.success('Finance entry added!');
        setIsEntryModalOpen(false);
        setReceiptFile(null);
        fetchEntries();
        fetchOverview();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePartner = async (e) => {
    e.preventDefault();
    if (!partnerForm.name.trim()) {
      return toast.error('Partner name is required');
    }

    try {
      setSubmitting(true);
      const res = await api.post('/admin/finance/partners', partnerForm);
      if (res.data?.success) {
        toast.success(`Partner ${partnerForm.name} added!`);
        setIsPartnerModalOpen(false);
        setPartnerForm({ name: '', phone: '', upiId: '', notes: '' });
        fetchPartners();
        fetchOverview();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add partner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSettlement = async (entryId, splitId, currentStatus) => {
    try {
      const res = await api.patch(
        `/admin/finance/entries/${entryId}/splits/${splitId}/settle`,
        { isSettled: !currentStatus }
      );
      if (res.data?.success) {
        toast.success(!currentStatus ? 'Marked as Settled' : 'Marked as Pending');
        // Update local entries state
        setEntries((prev) =>
          prev.map((e) => {
            if (e._id === entryId) {
              const updatedSplits = e.splits.map((s) =>
                s._id === splitId ? { ...s, isSettled: !currentStatus } : s
              );
              return { ...e, splits: updatedSplits };
            }
            return e;
          })
        );
        fetchOverview();
      }
    } catch (err) {
      toast.error('Failed to update settlement status');
    }
  };

  // Helper calculation for Equal split per person in modal
  const calcEqualShare = () => {
    const amt = Number(entryForm.amount) || 0;
    const count = entryForm.selectedPartnerIds.length;
    if (count === 0) return 0;
    return (amt / count).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-7 h-7 text-indigo-600" />
            FlashFits Finance & Expense Splitter
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage company cash flow, track partner purchase splits (Shubham, Efron, Udith, Visakh), and view settlement balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPartnerModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-sm"
          >
            <UserPlus size={16} />
            Add Partner
          </button>
          <button
            onClick={handleOpenEntryModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm"
          >
            <PlusCircle size={18} />
            Record Entry / Split
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview & Balances
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === 'entries'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Ledger & Transactions ({pagination.total})
        </button>
        <button
          onClick={() => setActiveTab('partners')}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === 'partners'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Partner List ({partners.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & BALANCES */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
                <span className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <TrendingDown size={18} />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{overview?.totalExpense?.toLocaleString('en-IN') || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {overview?.expenseCount || 0} recorded purchases/costs
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Income</span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp size={18} />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{overview?.totalIncome?.toLocaleString('en-IN') || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {overview?.incomeCount || 0} recorded income entries
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Net Cash Flow</span>
                <span className={`p-2 rounded-lg ${
                  (overview?.netProfitOrBurn || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  <DollarSign size={18} />
                </span>
              </div>
              <div className={`text-2xl font-black ${
                (overview?.netProfitOrBurn || 0) >= 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                ₹{overview?.netProfitOrBurn?.toLocaleString('en-IN') || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {(overview?.netProfitOrBurn || 0) >= 0 ? 'Positive Net' : 'Net Outflow / Investment'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Partners</span>
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users size={18} />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {partners.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {partners.map((p) => p.name).join(', ')}
              </div>
            </div>
          </div>

          {/* PARTNER SPLIT & SETTLEMENT CARDS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Partner Balances & Settlements</h2>
                <p className="text-xs text-slate-500">
                  Track who paid upfront for stock/supplies vs what each partner owes.
                </p>
              </div>
              <button
                onClick={fetchOverview}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {overview?.partnerSummary?.map((p) => {
                const isPositive = p.netBalance >= 0;
                return (
                  <div
                    key={p.partnerId}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center">
                            {p.partnerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{p.partnerName}</span>
                            {p.upiId && <span className="text-[10px] text-slate-400">{p.upiId}</span>}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isPositive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isPositive ? 'Gets Back' : 'Owes'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Paid Upfront:</span>
                          <span className="font-semibold text-slate-800">
                            ₹{p.totalPaidUpfront.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Assigned Share:</span>
                          <span className="font-semibold text-slate-800">
                            ₹{p.totalAssignedShare.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Already Settled:</span>
                          <span className="text-emerald-600 font-medium">
                            ₹{p.totalSettledShare.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Pending To Pay:</span>
                          <span className="text-rose-600 font-bold">
                            ₹{p.pendingOwedShare.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Net Position:</span>
                      <span
                        className={`text-base font-black ${
                          isPositive ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isPositive ? '+' : '-'}₹{Math.abs(p.netBalance).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" />
              Expense Breakdown by Category
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {overview?.categoryBreakdown?.map((cat) => (
                <div key={cat._id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block truncate">{cat._id}</span>
                  <span className="text-sm font-bold text-slate-900 block mt-0.5">
                    ₹{cat.totalAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400">{cat.count} entries</span>
                </div>
              ))}
              {(!overview?.categoryBreakdown || overview.categoryBreakdown.length === 0) && (
                <div className="text-xs text-slate-400 col-span-full py-4 text-center">
                  No expense category data yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEDGER / ENTRIES */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search description / title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchEntries()}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Types (Income & Expense)</option>
                <option value="EXPENSE">Expenses Only</option>
                <option value="INCOME">Income Only</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Categories</option>
                {[...CATEGORIES.EXPENSE, ...CATEGORIES.INCOME].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchEntries}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              Apply
            </button>
          </div>

          {/* Entries Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Paid By</th>
                    <th className="py-3 px-4">Receipt</th>
                    <th className="py-3 px-4">Partner Splits & Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {entries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                        {new Date(entry.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            entry.entryType === 'EXPENSE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {entry.entryType === 'EXPENSE' ? (
                            <ArrowDownLeft size={11} />
                          ) : (
                            <ArrowUpRight size={11} />
                          )}
                          {entry.entryType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate">
                        {entry.title}
                        {entry.notes && (
                          <span className="block text-[10px] font-normal text-slate-400 truncate">
                            {entry.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                          {entry.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 text-sm">
                        ₹{entry.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-[10px] font-bold flex items-center justify-center text-slate-700">
                            {entry.paidByName.charAt(0)}
                          </span>
                          <span className="truncate max-w-[120px]">{entry.paidByName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {entry.receiptUrl ? (
                          <a
                            href={entry.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-semibold border border-indigo-200 transition"
                          >
                            <FileText size={11} />
                            View Bill
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {entry.isSplit && entry.splits && entry.splits.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {entry.splits.map((split) => (
                              <button
                                key={split._id}
                                onClick={() =>
                                  handleToggleSettlement(entry._id, split._id, split.isSettled)
                                }
                                title={`Click to toggle settlement for ${split.partnerName}`}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition cursor-pointer ${
                                  split.isSettled
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                }`}
                              >
                                {split.isSettled ? (
                                  <CheckCircle2 size={11} className="text-emerald-600" />
                                ) : (
                                  <Clock size={11} className="text-amber-500" />
                                )}
                                <span>{split.partnerName}:</span>
                                <span className="font-bold">₹{split.shareAmount}</span>
                                <span className="text-[9px] opacity-75">
                                  ({split.isSettled ? 'Paid' : 'Unpaid'})
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No Split</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No finance entries recorded yet. Click "Record Entry / Split" above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-md disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-md disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PARTNERS LIST */}
      {activeTab === 'partners' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Configured Partners</h2>
                <p className="text-xs text-slate-500">
                  Partners participating in FlashFits purchase splits and capital tracking.
                </p>
              </div>
              <button
                onClick={() => setIsPartnerModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <PlusCircle size={14} /> Add Partner
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {partners.map((p) => (
                <div key={p._id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                      <span className="text-[11px] text-slate-400 block">{p.phone || 'No phone'}</span>
                    </div>
                  </div>
                  {p.upiId && (
                    <div className="mt-3 text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">UPI ID:</span>
                      <span className="font-mono text-slate-700">{p.upiId}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD NEW ENTRY / SPLIT */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="text-indigo-600" size={20} />
                Record Finance Entry
              </h3>
              <button
                onClick={() => setIsEntryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() =>
                    setEntryForm((prev) => ({
                      ...prev,
                      entryType: 'EXPENSE',
                      category: 'Inventory / Dresses'
                    }))
                  }
                  className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                    entryForm.entryType === 'EXPENSE'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Expense / Purchase
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEntryForm((prev) => ({
                      ...prev,
                      entryType: 'INCOME',
                      category: 'Orders & Sales'
                    }))
                  }
                  className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                    entryForm.entryType === 'INCOME'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Income / Inflow
                </button>
              </div>

              {/* Title & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Title / Item Description *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dresses stock purchase, Server bills, Delivery bags..."
                    value={entryForm.title}
                    onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 10000"
                    value={entryForm.amount}
                    onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={entryForm.category}
                    onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    {(entryForm.entryType === 'EXPENSE'
                      ? CATEGORIES.EXPENSE
                      : CATEGORIES.INCOME
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Payment Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={entryForm.date}
                    onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={entryForm.paymentMode}
                    onChange={(e) => setEntryForm({ ...entryForm, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Who Paid Upfront? */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Who paid upfront?
                </label>
                <select
                  value={entryForm.paidByPartner}
                  onChange={(e) => setEntryForm({ ...entryForm, paidByPartner: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">🏢 Company Account / FlashFits Pool</option>
                  {partners.map((p) => (
                    <option key={p._id} value={p._id}>
                      👤 Partner: {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Split Settings */}
              {entryForm.entryType === 'EXPENSE' && (
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Users size={15} className="text-indigo-600" />
                      Split among partners?
                    </label>
                    <input
                      type="checkbox"
                      checked={entryForm.isSplit}
                      onChange={(e) => setEntryForm({ ...entryForm, isSplit: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                  </div>

                  {entryForm.isSplit && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      {/* Split Mode: Equal or Custom */}
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                          <input
                            type="radio"
                            name="splitType"
                            checked={entryForm.splitType === 'EQUAL'}
                            onChange={() => setEntryForm({ ...entryForm, splitType: 'EQUAL' })}
                          />
                          Equal Split (1/{entryForm.selectedPartnerIds.length || 1})
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                          <input
                            type="radio"
                            name="splitType"
                            checked={entryForm.splitType === 'CUSTOM'}
                            onChange={() => setEntryForm({ ...entryForm, splitType: 'CUSTOM' })}
                          />
                          Custom Amount
                        </label>
                      </div>

                      {/* Select Partners Checkboxes */}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                          Select who is involved in this split:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {partners.map((p) => {
                            const isChecked = entryForm.selectedPartnerIds.includes(p._id);
                            return (
                              <div
                                key={p._id}
                                onClick={() => handlePartnerToggle(p._id)}
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                                  isChecked
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-500'
                                }`}
                              >
                                <span>{p.name}</span>
                                {isChecked && entryForm.splitType === 'EQUAL' && (
                                  <span className="text-[10px] text-indigo-600 font-bold">
                                    ₹{calcEqualShare()}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom inputs if splitType is CUSTOM */}
                      {entryForm.splitType === 'CUSTOM' && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-semibold text-slate-500 block">
                            Enter share amount per person:
                          </span>
                          {entryForm.selectedPartnerIds.map((pId) => {
                            const pDoc = partners.find((p) => p._id === pId);
                            return (
                              <div key={pId} className="flex items-center justify-between gap-2">
                                <span className="text-slate-700 font-medium">{pDoc?.name}:</span>
                                <input
                                  type="number"
                                  placeholder="Amount"
                                  value={entryForm.customShares[pId] || ''}
                                  onChange={(e) =>
                                    setEntryForm((prev) => ({
                                      ...prev,
                                      customShares: {
                                        ...prev.customShares,
                                        [pId]: e.target.value
                                      }
                                    }))
                                  }
                                  className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-md text-right font-bold"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Optional Receipt File Upload */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Paperclip size={13} className="text-slate-500" />
                    Bill / Receipt / Invoice <span className="text-slate-400 font-normal">(Optional)</span>
                  </span>
                  {receiptFile && (
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Remove file
                    </button>
                  )}
                </label>
                <div className="relative border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 transition text-center">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {receiptFile ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-700 font-medium">
                      <FileText size={15} />
                      <span className="truncate max-w-xs">{receiptFile.name}</span>
                      <span className="text-[10px] text-slate-400">
                        ({(receiptFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <span className="text-indigo-600 font-semibold">Click to upload</span> or drag and drop (PNG, JPG, PDF)
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional details, invoice number, payment ref..."
                  value={entryForm.notes}
                  onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD PARTNER */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="text-indigo-600" size={18} />
                Add New Partner
              </h3>
              <button
                onClick={() => setIsPartnerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Partner Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shubham, Efron, etc."
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91..."
                  value={partnerForm.phone}
                  onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">UPI ID (for payments)</label>
                <input
                  type="text"
                  placeholder="name@okaxis"
                  value={partnerForm.upiId}
                  onChange={(e) => setPartnerForm({ ...partnerForm, upiId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPartnerModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

