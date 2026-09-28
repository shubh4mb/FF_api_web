import React, { useState, useEffect, useRef } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  DollarSign,
  PlusCircle,
  FileText,
  User,
  Store,
  Bike,
  Copy,
  Check,
  Eye,
  X,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Building2,
  Receipt,
  HelpCircle,
} from "lucide-react";
import {
  getTransactions,
  createManualTransaction,
  searchRecipients,
} from "@/api/transactions";
import toast from "react-hot-toast";

const CATEGORY_CONFIG = {
  merchant_payout: {
    label: "Merchant Payout",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    defaultType: "debit",
    recipientType: "merchant",
    icon: Store,
  },
  rider_payout: {
    label: "Rider Payout",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    defaultType: "debit",
    recipientType: "rider",
    icon: Bike,
  },
  user_refund: {
    label: "Customer Refund",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    defaultType: "debit",
    recipientType: "user",
    icon: User,
  },
  customer_payment: {
    label: "Customer Payment",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    defaultType: "credit",
    recipientType: "user",
    icon: User,
  },
  delivery_fee_recovery: {
    label: "Fee Recovery",
    color: "bg-teal-100 text-teal-700 border-teal-200",
    defaultType: "credit",
    recipientType: "user",
    icon: User,
  },
  damage_compensation: {
    label: "Damage Compensation",
    color: "bg-rose-100 text-rose-700 border-rose-200",
    defaultType: "debit",
    recipientType: "merchant",
    icon: Store,
  },
  adjustment: {
    label: "Adjustment / Other",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    defaultType: "debit",
    recipientType: "other",
    icon: Building2,
  },
};

const PAYMENT_METHOD_LABELS = {
  upi: "UPI Transfer",
  bank_transfer: "Bank Transfer (NEFT/IMPS)",
  cash: "Cash",
  razorpay: "Razorpay Gateway",
  wallet: "In-App Wallet",
  cheque: "Cheque",
  other: "Other",
};

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    totalInflow: 0,
    totalOutflow: 0,
    netBalance: 0,
    totalRefunds: 0,
    totalMerchantPayouts: 0,
    totalRiderPayouts: 0,
    manualCount: 0,
    totalTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filters state
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    type: "all",
    source: "all",
    paymentMethod: "all",
    recipientType: "all",
    startDate: "",
    endDate: "",
  });

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedTxnDetails, setSelectedTxnDetails] = useState(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Form state for Record Manual Transaction
  const [formData, setFormData] = useState({
    category: "merchant_payout",
    type: "debit",
    amount: "",
    paymentMethod: "upi",
    referenceNumber: "",
    recipientType: "merchant",
    recipientId: "",
    orderId: "",
    notes: "",
    recipientDetails: {
      name: "",
      phone: "",
      email: "",
      shopName: "",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      upiId: "",
    },
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Recipient search autocomplete inside modal
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [selectedRecipientObject, setSelectedRecipientObject] = useState(null);

  // Debounced search for transactions
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchTransactions = async (page = 1) => {
    try {
      setLoading(true);
      const res = await getTransactions({
        ...filters,
        page,
        limit: 20,
      });
      if (res.success) {
        setTransactions(res.transactions || []);
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (error) {
      toast.error(error.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      category: "all",
      type: "all",
      source: "all",
      paymentMethod: "all",
      recipientType: "all",
      startDate: "",
      endDate: "",
    });
  };

  // Recipient search inside modal
  useEffect(() => {
    if (!isRecordModalOpen) return;
    if (recipientSearchQuery.trim().length < 2) {
      setRecipientResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingRecipients(true);
        const res = await searchRecipients(formData.recipientType, recipientSearchQuery);
        if (res.success) {
          setRecipientResults(res.results || []);
        }
      } catch (err) {
        console.error("Recipient search error:", err);
      } finally {
        setSearchingRecipients(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [recipientSearchQuery, formData.recipientType, isRecordModalOpen]);

  const handleCategoryChange = (newCat) => {
    const config = CATEGORY_CONFIG[newCat] || {};
    const defaultType = config.defaultType || "debit";
    const defaultRecType = config.recipientType || "other";

    setFormData((prev) => ({
      ...prev,
      category: newCat,
      type: defaultType,
      recipientType: defaultRecType !== "other" ? defaultRecType : prev.recipientType,
      recipientId: "",
      recipientDetails: {
        name: "",
        phone: "",
        email: "",
        shopName: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        upiId: "",
      },
    }));
    setSelectedRecipientObject(null);
    setRecipientSearchQuery("");
    setRecipientResults([]);
  };

  const handleSelectRecipient = (r) => {
    setSelectedRecipientObject(r);
    setFormData((prev) => ({
      ...prev,
      recipientId: r._id,
      recipientDetails: {
        name: r.name || "",
        phone: r.phone || "",
        email: r.email || "",
        shopName: r.shopName || "",
        bankName: r.bankName || "",
        accountNumber: r.accountNumber || "",
        ifscCode: r.ifscCode || "",
        upiId: r.upiId || "",
      },
    }));
    setRecipientResults([]);
    setRecipientSearchQuery("");
  };

  const handleClearSelectedRecipient = () => {
    setSelectedRecipientObject(null);
    setFormData((prev) => ({
      ...prev,
      recipientId: "",
      recipientDetails: {
        name: "",
        phone: "",
        email: "",
        shopName: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        upiId: "",
      },
    }));
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB.");
      return;
    }

    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
      setReceiptPreview(null);
    }
  };

  const handleSubmitManualTransaction = async (e) => {
    e.preventDefault();

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount greater than ₹0.");
      return;
    }

    if (!formData.referenceNumber.trim()) {
      toast.error("Reference / UTR Number is required for audit verification.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = new FormData();
      payload.append("category", formData.category);
      payload.append("type", formData.type);
      payload.append("amount", formData.amount);
      payload.append("paymentMethod", formData.paymentMethod);
      payload.append("referenceNumber", formData.referenceNumber.trim());
      payload.append("recipientType", formData.recipientType);

      if (formData.recipientId) {
        payload.append("recipientId", formData.recipientId);
      }
      if (formData.orderId) {
        payload.append("orderId", formData.orderId.trim());
      }
      if (formData.notes) {
        payload.append("notes", formData.notes.trim());
      }

      payload.append("recipientDetails", JSON.stringify(formData.recipientDetails));

      if (receiptFile) {
        payload.append("receipt", receiptFile);
      }

      const res = await createManualTransaction(payload);
      if (res.success) {
        toast.success("Transaction recorded successfully!");
        setIsRecordModalOpen(false);
        resetModalForm();
        fetchTransactions(1);
      }
    } catch (error) {
      toast.error(error.message || "Failed to record transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetModalForm = () => {
    setFormData({
      category: "merchant_payout",
      type: "debit",
      amount: "",
      paymentMethod: "upi",
      referenceNumber: "",
      recipientType: "merchant",
      recipientId: "",
      orderId: "",
      notes: "",
      recipientDetails: {
        name: "",
        phone: "",
        email: "",
        shopName: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        upiId: "",
      },
    });
    handleRemoveReceipt();
    setSelectedRecipientObject(null);
    setRecipientSearchQuery("");
    setRecipientResults([]);
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
              <CreditCard className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Money Transactions & Ledger
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1.5 ml-1">
            Audit automated incoming payments, log manual merchant & rider payouts, and track customer refunds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchTransactions(pagination.page)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium text-sm transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => {
              resetModalForm();
              setIsRecordModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-sky-500/20 hover:shadow-sky-500/35 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Record Manual Transaction
          </button>
        </div>
      </div>

      {/* ── Financial Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Inflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Inflow (Cash In)
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              ₹{(summary.totalInflow || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="inline-block mt-1 text-xs text-emerald-600 font-medium">
              Order collections & fees
            </span>
          </div>
        </div>

        {/* Card 2: Total Outflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Outflow (Cash Out)
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              ₹{(summary.totalOutflow || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="inline-block mt-1 text-xs text-rose-600 font-medium">
              Payouts & Refunds
            </span>
          </div>
        </div>

        {/* Card 3: Net Cashflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Net Balance
            </span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-extrabold ${
                (summary.netBalance || 0) >= 0 ? "text-slate-900" : "text-rose-600"
              }`}
            >
              ₹{(summary.netBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="inline-block mt-1 text-xs text-slate-500 font-medium">
              Inflow minus Outflow
            </span>
          </div>
        </div>

        {/* Card 4: Customer Refunds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Customer Refunds
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              ₹{(summary.totalRefunds || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <span className="inline-block mt-1 text-xs text-amber-600 font-medium">
              Returned order balances
            </span>
          </div>
        </div>

        {/* Card 5: Manual Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Manual Additions
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900">
              {summary.manualCount || 0}
            </div>
            <span className="inline-block mt-1 text-xs text-purple-600 font-medium">
              Admin recorded transfers
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters Section ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search UTR, Txn ID, name, phone..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange("category", e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all text-slate-700"
          >
            <option value="all">All Categories</option>
            <option value="merchant_payout">Merchant Payout</option>
            <option value="rider_payout">Rider Payout</option>
            <option value="user_refund">Customer Refund</option>
            <option value="customer_payment">Customer Payment</option>
            <option value="delivery_fee_recovery">Delivery Fee Recovery</option>
            <option value="damage_compensation">Damage Compensation</option>
            <option value="adjustment">Adjustment</option>
          </select>

          {/* Type Filter (Credit / Debit) */}
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange("type", e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all text-slate-700"
          >
            <option value="all">All Flows (Credit & Debit)</option>
            <option value="credit">Inflow (+ Credit)</option>
            <option value="debit">Outflow (- Debit)</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={filters.paymentMethod}
            onChange={(e) => handleFilterChange("paymentMethod", e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all text-slate-700"
          >
            <option value="all">All Payment Methods</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer (IMPS/NEFT)</option>
            <option value="cash">Cash</option>
            <option value="razorpay">Razorpay</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            {/* Recipient Type */}
            <select
              value={filters.recipientType}
              onChange={(e) => handleFilterChange("recipientType", e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Parties</option>
              <option value="merchant">Merchants</option>
              <option value="rider">Riders</option>
              <option value="user">Customers</option>
            </select>

            {/* Source */}
            <select
              value={filters.source}
              onChange={(e) => handleFilterChange("source", e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Sources</option>
              <option value="manual_admin">Manual (Admin)</option>
              <option value="system_razorpay">System (Razorpay)</option>
              <option value="system_cod">System (COD)</option>
              <option value="system_auto">System (Auto)</option>
            </select>

            {/* Date inputs */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>From:</span>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
              />
              <span>To:</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* ── Transactions Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Date & Txn ID</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Recipient / Party</th>
                <th className="py-3.5 px-4">Method & UTR</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-center">Receipt</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
                    Loading financial ledger...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-16 text-slate-400">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-700">No transactions found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or record a manual transaction.
                    </p>
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => {
                  const catConfig = CATEGORY_CONFIG[txn.category] || {
                    label: txn.category,
                    color: "bg-slate-100 text-slate-700",
                    icon: Building2,
                  };
                  const CatIcon = catConfig.icon;
                  const isCredit = txn.type === "credit";

                  return (
                    <tr
                      key={txn._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Date & Txn ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {new Date(txn.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>
                            {new Date(txn.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {txn.transactionId}
                          </span>
                        </div>
                        {txn.source === "manual_admin" && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded text-[10px] font-semibold">
                            Manual Admin
                          </span>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${catConfig.color}`}
                        >
                          <CatIcon className="w-3.5 h-3.5" />
                          {catConfig.label}
                        </span>
                        {txn.orderId && (
                          <div className="text-[11px] text-slate-400 mt-1">
                            Order: #{String(txn.orderId?._id || txn.orderId).slice(-6)}
                          </div>
                        )}
                      </td>

                      {/* Recipient / Party */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 max-w-[200px] truncate">
                          {txn.recipientDetails?.name ||
                            txn.recipientDetails?.shopName ||
                            txn.recipientType?.toUpperCase() ||
                            "Platform"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {txn.recipientDetails?.phone && (
                            <span>{txn.recipientDetails.phone}</span>
                          )}
                          {txn.recipientDetails?.upiId && (
                            <span className="ml-1 text-[11px] text-purple-600 font-mono">
                              ({txn.recipientDetails.upiId})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Method & UTR */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 text-xs">
                          {PAYMENT_METHOD_LABELS[txn.paymentMethod] || txn.paymentMethod}
                        </div>
                        {txn.referenceNumber ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-xs text-slate-600">
                              {txn.referenceNumber}
                            </span>
                            <button
                              onClick={() => copyToClipboard(txn.referenceNumber, txn._id)}
                              className="text-slate-400 hover:text-sky-600 transition-colors p-0.5"
                              title="Copy UTR / Reference"
                            >
                              {copiedId === txn._id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No Ref/UTR</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold text-base ${
                            isCredit ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isCredit ? "+" : "-"} ₹
                          {txn.amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {txn.type} ({txn.status})
                        </div>
                      </td>

                      {/* Receipt Preview */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {txn.receipt?.url ? (
                          <button
                            onClick={() => setPreviewReceiptUrl(txn.receipt.url)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-600 rounded-lg text-xs font-medium text-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTxnDetails(txn)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total transactions)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchTransactions(pagination.page - 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchTransactions(pagination.page + 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Record Manual Transaction ── */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Record Manual Transaction</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Record an off-app payout to merchant/rider or a refund to customer with proof & UTR.
                </p>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitManualTransaction} className="p-6 space-y-5">
              {/* Category Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Transaction Purpose / Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                    const isSelected = formData.category === key;
                    const Icon = config.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCategoryChange(key)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          isSelected
                            ? "border-sky-500 bg-sky-50/70 text-sky-900 shadow-xs ring-1 ring-sky-500/20"
                            : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? "text-sky-600" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Flow Direction Indicator */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 text-xs ${
                  formData.type === "debit"
                    ? "bg-rose-50/70 border-rose-200 text-rose-800"
                    : "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg ${
                    formData.type === "debit"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {formData.type === "debit" ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className="font-bold">
                    {formData.type === "debit"
                      ? "Outflow (Platform Debit): "
                      : "Inflow (Platform Credit): "}
                  </span>
                  <span>
                    {formData.type === "debit"
                      ? "Money is being disbursed from FlashFits account to recipient."
                      : "Money is entering FlashFits account."}
                  </span>
                </div>
              </div>

              {/* Recipient Selection & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Recipient / Beneficiary *
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {["merchant", "rider", "user", "other"].map((rType) => (
                      <label key={rType} className="flex items-center gap-1 cursor-pointer capitalize">
                        <input
                          type="radio"
                          name="recipientType"
                          value={rType}
                          checked={formData.recipientType === rType}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              recipientType: e.target.value,
                              recipientId: "",
                            }));
                            setSelectedRecipientObject(null);
                            setRecipientSearchQuery("");
                          }}
                          className="text-sky-600 focus:ring-sky-500 text-xs"
                        />
                        <span>{rType}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Recipient Autocomplete input */}
                {formData.recipientType !== "other" && !selectedRecipientObject && (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={`Search ${formData.recipientType} by name, phone, or shop...`}
                      value={recipientSearchQuery}
                      onChange={(e) => setRecipientSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                    />

                    {/* Results Dropdown */}
                    {recipientResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto z-20 divide-y divide-slate-100">
                        {recipientResults.map((r) => (
                          <button
                            key={r._id}
                            type="button"
                            onClick={() => handleSelectRecipient(r)}
                            className="w-full px-4 py-2.5 text-left hover:bg-sky-50 transition-colors flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">
                                {r.name} {r.shopName ? `(${r.shopName})` : ""}
                              </div>
                              <div className="text-slate-500 text-[11px] mt-0.5">
                                {r.phone} {r.upiId ? `• UPI: ${r.upiId}` : ""}
                              </div>
                            </div>
                            {r.pendingBalance !== undefined && (
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">Pending</span>
                                <span className="font-bold text-sky-700">₹{r.pendingBalance}</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Recipient Card */}
                {selectedRecipientObject && (
                  <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                        {formData.recipientType === "merchant" ? (
                          <Store className="w-4 h-4" />
                        ) : formData.recipientType === "rider" ? (
                          <Bike className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {formData.recipientDetails.name || formData.recipientDetails.shopName}
                        </div>
                        <div className="text-slate-600 mt-0.5 space-x-2">
                          <span>{formData.recipientDetails.phone}</span>
                          {formData.recipientDetails.bankName && (
                            <span>• Bank: {formData.recipientDetails.bankName}</span>
                          )}
                          {formData.recipientDetails.accountNumber && (
                            <span>• A/C: {formData.recipientDetails.accountNumber}</span>
                          )}
                          {formData.recipientDetails.upiId && (
                            <span>• UPI: {formData.recipientDetails.upiId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelectedRecipient}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-1"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Manual details override if 'other' or need customization */}
                {(!selectedRecipientObject || formData.recipientType === "other") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Recipient Full Name"
                      value={formData.recipientDetails.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          recipientDetails: { ...prev.recipientDetails, name: e.target.value },
                        }))
                      }
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Recipient Phone Number"
                      value={formData.recipientDetails.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          recipientDetails: { ...prev.recipientDetails, phone: e.target.value },
                        }))
                      }
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="UPI ID (e.g. mobile@upi)"
                      value={formData.recipientDetails.upiId}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          recipientDetails: { ...prev.recipientDetails, upiId: e.target.value },
                        }))
                      }
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Bank Account Number"
                      value={formData.recipientDetails.accountNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          recipientDetails: {
                            ...prev.recipientDetails,
                            accountNumber: e.target.value,
                          },
                        }))
                      }
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Amount & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Amount Paid (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      required
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, amount: e.target.value }))
                      }
                      className="w-full pl-8 pr-4 py-2.5 text-base font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Payment Method *
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 text-slate-700 font-medium"
                  >
                    <option value="upi">UPI Transfer (GooglePay/PhonePe/Paytm)</option>
                    <option value="bank_transfer">Bank Transfer (IMPS / NEFT / RTGS)</option>
                    <option value="cash">Cash Handover</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Reference / UTR Number & Optional Order ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Reference / UTR Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 423985729184 or UPI Ref"
                    value={formData.referenceNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, referenceNumber: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Associated Order ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 660f9a2e..."
                    value={formData.orderId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, orderId: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Payment Proof / Receipt Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Payment Proof / Receipt Screenshot (Optional)
                </label>
                {receiptPreview ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-xs"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-800 block truncate">
                        {receiptFile?.name}
                      </span>
                      <span className="text-slate-400">
                        {((receiptFile?.size || 0) / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveReceipt}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50/70 transition-colors text-center">
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-xs font-semibold text-sky-600">
                      Upload receipt screenshot
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      PNG, JPG up to 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Notes / Audit Remarks
                </label>
                <textarea
                  rows="2"
                  placeholder="Additional context or remarks for internal financial audit..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-xs shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving Transaction...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm & Record Transaction
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Transaction Details ── */}
      {selectedTxnDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-mono uppercase">
                  {selectedTxnDetails.transactionId}
                </span>
                <h3 className="text-base font-bold">Transaction Record</h3>
              </div>
              <button
                onClick={() => setSelectedTxnDetails(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Amount</span>
                <span
                  className={`text-xl font-extrabold ${
                    selectedTxnDetails.type === "credit"
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {selectedTxnDetails.type === "credit" ? "+" : "-"} ₹
                  {selectedTxnDetails.amount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Category</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {selectedTxnDetails.category?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Payment Mode</span>
                  <span className="font-semibold text-slate-800">
                    {PAYMENT_METHOD_LABELS[selectedTxnDetails.paymentMethod] ||
                      selectedTxnDetails.paymentMethod}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Flow Direction</span>
                  <span className="font-semibold text-slate-800 uppercase">
                    {selectedTxnDetails.type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Date & Time</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedTxnDetails.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* UTR / Ref */}
              <div className="pb-3 border-b border-slate-100">
                <span className="text-slate-400 block text-[11px]">Reference / UTR</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {selectedTxnDetails.referenceNumber || "N/A"}
                  </span>
                  {selectedTxnDetails.referenceNumber && (
                    <button
                      onClick={() =>
                        copyToClipboard(
                          selectedTxnDetails.referenceNumber,
                          selectedTxnDetails._id
                        )
                      }
                      className="text-sky-600 hover:text-sky-800"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Recipient Snapshot */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Beneficiary Details
                </span>
                <div className="font-bold text-slate-900">
                  {selectedTxnDetails.recipientDetails?.name ||
                    selectedTxnDetails.recipientDetails?.shopName ||
                    "N/A"}
                </div>
                {selectedTxnDetails.recipientDetails?.phone && (
                  <div className="text-slate-600">
                    Phone: {selectedTxnDetails.recipientDetails.phone}
                  </div>
                )}
                {selectedTxnDetails.recipientDetails?.upiId && (
                  <div className="text-slate-600 font-mono">
                    UPI: {selectedTxnDetails.recipientDetails.upiId}
                  </div>
                )}
                {selectedTxnDetails.recipientDetails?.accountNumber && (
                  <div className="text-slate-600 font-mono">
                    Bank A/C: {selectedTxnDetails.recipientDetails.accountNumber} (
                    {selectedTxnDetails.recipientDetails.ifscCode || ""})
                  </div>
                )}
              </div>

              {/* Notes & Admin Audit */}
              {selectedTxnDetails.notes && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Remarks</span>
                  <p className="text-slate-700 italic mt-0.5">
                    "{selectedTxnDetails.notes}"
                  </p>
                </div>
              )}

              <div className="text-[11px] text-slate-400 pt-2 flex items-center justify-between">
                <span>
                  Recorded by: {selectedTxnDetails.performedBy?.name || "System"}
                </span>
                {selectedTxnDetails.receipt?.url && (
                  <button
                    onClick={() => {
                      setPreviewReceiptUrl(selectedTxnDetails.receipt.url);
                      setSelectedTxnDetails(null);
                    }}
                    className="text-sky-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> View Attached Proof
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Receipt Image Viewer ── */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-semibold text-sm">Payment Receipt Evidence</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-slate-400 hover:text-white"
                  title="Open Full Image"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewReceiptUrl(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-100">
              <img
                src={previewReceiptUrl}
                alt="Payment receipt proof"
                className="max-h-[70vh] object-contain rounded-lg border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
