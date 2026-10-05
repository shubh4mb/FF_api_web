import React, { useEffect, useState, useMemo } from "react";
import {
  getSupportTickets,
  updateTicketStatus,
  getSupportStats,
  getTicketDetails,
} from "../../api/support";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  RefreshCw,
  ChevronDown,
  Eye,
  Camera,
  Package,
  X,
  User,
  Phone,
  Mail,
  ShoppingBag,
  ExternalLink,
  Send,
  Sparkles,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ShieldAlert,
  FileText,
  AlertTriangle,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

const CATEGORY_LABELS = {
  order_delayed: "Order Delayed",
  return_issue: "Return Issue",
  try_buy_issue: "Try & Buy Issue",
  refund_issue: "Refund Issue",
  wrong_product: "Wrong Product",
  damaged_product: "Damaged Product",
  misplaced_product: "Misplaced Product",
  size_exchange: "Size Exchange",
  merchant_issue: "Merchant Issue",
  report_bug: "Report a Bug",
  other: "Other Issue",
};

const CATEGORY_COLORS = {
  damaged_product: "bg-rose-50 text-rose-700 border-rose-200",
  wrong_product: "bg-orange-50 text-orange-700 border-orange-200",
  misplaced_product: "bg-amber-50 text-amber-700 border-amber-200",
  order_delayed: "bg-blue-50 text-blue-700 border-blue-200",
  refund_issue: "bg-purple-50 text-purple-700 border-purple-200",
  return_issue: "bg-indigo-50 text-indigo-700 border-indigo-200",
  try_buy_issue: "bg-cyan-50 text-cyan-700 border-cyan-200",
  size_exchange: "bg-teal-50 text-teal-700 border-teal-200",
  merchant_issue: "bg-pink-50 text-pink-700 border-pink-200",
  report_bug: "bg-slate-100 text-slate-700 border-slate-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_COLORS = {
  open: "bg-red-50 text-red-700 border-red-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const ACTION_LABELS = {
  none: "No Direct Action",
  refund_issued: "Refund Issued",
  replacement_offered: "Replacement Offered",
  explained_policy: "Policy Clarified",
  rider_cautioned: "Rider Cautioned",
  merchant_contacted: "Merchant Contacted",
  rejected: "Rejected / Denied",
  other: "Other Action",
};

const QUICK_TEMPLATES = [
  {
    label: "Refund Initiated",
    action: "refund_issued",
    status: "resolved",
    text: "We have reviewed your report and processed a full refund to your original payment method. The refund will reflect in your account within 2-4 business days.",
  },
  {
    label: "Replacement Dispatched",
    action: "replacement_offered",
    status: "resolved",
    text: "We sincerely apologize for the mix-up. A replacement item has been prepared and dispatched for urgent delivery to your registered address.",
  },
  {
    label: "Rider Delay Addressed",
    action: "rider_cautioned",
    status: "resolved",
    text: "We have addressed this delivery delay with our logistics partner and taken corrective action. Thank you for your patience.",
  },
  {
    label: "Investigating Issue",
    action: "merchant_contacted",
    status: "in_progress",
    text: "Our support and operations team is currently investigating your ticket with the merchant. We will notify you with resolution shortly.",
  },
  {
    label: "Policy Clarification",
    action: "explained_policy",
    status: "closed",
    text: "As per FlashFits return and exchange terms, products must be returned in original condition with tags intact. Please reach out if you have further questions.",
  },
];

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [updatingId, setUpdatingId] = useState(null);

  // Selected Ticket for Modal Resolution
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [savingResolution, setSavingResolution] = useState(false);
  const [modalStatus, setModalStatus] = useState("resolved");
  const [modalAction, setModalAction] = useState("refund_issued");
  const [modalNotes, setModalNotes] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Lightbox for photos
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filter) params.status = filter;
      const res = await getSupportTickets(params);
      setTickets(res.tickets || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      toast.error("Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await getSupportStats();
      setStats(res.stats || { open: 0, inProgress: 0, resolved: 0, total: 0 });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [page, filter]);

  // Handle Opening Ticket Modal
  const handleOpenTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setModalStatus(ticket.status || "resolved");
    setModalAction(ticket.adminAction || "none");
    setModalNotes(ticket.resolutionNotes || "");

    // Optionally fetch fresh single ticket details for populated order items
    setModalLoading(true);
    try {
      const res = await getTicketDetails(ticket._id);
      if (res.ticket) {
        setSelectedTicket(res.ticket);
        setModalStatus(res.ticket.status || "resolved");
        setModalAction(res.ticket.adminAction || "none");
        setModalNotes(res.ticket.resolutionNotes || "");
      }
    } catch (err) {
      // Keep existing ticket data if single fetch fails
      console.warn("Could not load extended ticket details:", err);
    } finally {
      setModalLoading(false);
    }
  };

  // Quick inline status change dropdown
  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await updateTicketStatus(id, { status: newStatus });
      setTickets((prev) =>
        prev.map((t) => (t._id === id ? { ...t, status: newStatus } : t))
      );
      fetchStats();
      toast.success(`Ticket marked as ${STATUS_LABELS[newStatus] || newStatus}`);
    } catch (err) {
      console.error("Failed to update:", err);
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Submit Full Resolution from Modal
  const handleSaveResolution = async () => {
    if (!selectedTicket) return;

    if (modalStatus === "resolved" && !modalNotes.trim()) {
      toast.error("Please add resolution notes to explain how the issue was resolved.");
      return;
    }

    setSavingResolution(true);
    try {
      const res = await updateTicketStatus(selectedTicket._id, {
        status: modalStatus,
        adminAction: modalAction,
        resolutionNotes: modalNotes.trim(),
      });

      const updated = res.ticket || {
        ...selectedTicket,
        status: modalStatus,
        adminAction: modalAction,
        resolutionNotes: modalNotes.trim(),
        resolvedAt: new Date(),
      };

      setTickets((prev) => prev.map((t) => (t._id === selectedTicket._id ? updated : t)));
      setSelectedTicket(updated);
      fetchStats();
      toast.success("Resolution saved! Push notification sent to customer.");
      setSelectedTicket(null);
    } catch (err) {
      console.error("Failed to save resolution:", err);
      toast.error("Failed to save resolution");
    } finally {
      setSavingResolution(false);
    }
  };

  // Copy phone number
  const handleCopyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success("Phone number copied to clipboard");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Filtered tickets on client for instant search
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (categoryFilter && ticket.category !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const ticketId = (ticket._id || "").toLowerCase();
      const userName = (ticket.userId?.name || "").toLowerCase();
      const phone = (ticket.phone || "").toLowerCase();
      const message = (ticket.message || "").toLowerCase();
      const orderId = String(ticket.orderId?._id || ticket.orderId || "").toLowerCase();
      const itemName = (ticket.itemDetails?.name || "").toLowerCase();

      return (
        ticketId.includes(q) ||
        userName.includes(q) ||
        phone.includes(q) ||
        message.includes(q) ||
        orderId.includes(q) ||
        itemName.includes(q)
      );
    });
  }, [tickets, categoryFilter, searchQuery]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="p-2 sm:p-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <span>Support Tickets & Issue Resolution</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-700">
              Admin Center
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review customer claims, inspect photographic evidence, resolve disputes, and send in-app updates
          </p>
        </div>
        <button
          onClick={() => {
            fetchTickets();
            fetchStats();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-500" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Tickets
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-1">All tickets submitted</p>
        </div>

        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">
              Open / Pending
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.open}</p>
          <p className="text-xs text-red-400 mt-1">Requires admin attention</p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
              In Progress
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.inProgress}</p>
          <p className="text-xs text-amber-400 mt-1">Under investigation</p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
              Resolved
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.resolved}</p>
          <p className="text-xs text-emerald-400 mt-1">Successfully resolved</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Filter className="w-4 h-4 text-slate-400 mr-1 flex-shrink-0" />
          {[
            { key: "", label: "All Tickets" },
            { key: "open", label: "Open" },
            { key: "in_progress", label: "In Progress" },
            { key: "resolved", label: "Resolved" },
            { key: "closed", label: "Closed" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilter(tab.key);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                filter === tab.key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200 transition-all"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ticket, customer, order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-200 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-20 flex flex-col items-center justify-center shadow-sm">
          <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 mt-4 font-medium">Loading support tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No support tickets found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {filter || categoryFilter || searchQuery
              ? "Try adjusting your filters or search keywords to find tickets."
              : "When customers report product issues, damaged orders, or bugs, they will show up here."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Ticket ID / Time</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Reported Issue & Evidence</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Resolution / Action</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTickets.map((ticket) => {
                  const hasPhotos = ticket.images && ticket.images.length > 0;
                  const hasItem = ticket.itemDetails && ticket.itemDetails.name;
                  const orderIdString = ticket.orderId?._id || ticket.orderId;

                  return (
                    <tr
                      key={ticket._id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => handleOpenTicket(ticket)}
                    >
                      {/* Ticket ID & Time */}
                      <td className="px-5 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>#{ticket._id.slice(-6).toUpperCase()}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {timeAgo(ticket.createdAt)}
                        </div>
                        <div className="text-[10px] text-slate-400">{formatDate(ticket.createdAt)}</div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {ticket.userId?.name || "Customer"}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{ticket.phone || "No phone"}</span>
                        </div>
                        {ticket.userId?.email && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {ticket.userId.email}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            CATEGORY_COLORS[ticket.category] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </span>
                      </td>

                      {/* Reported Issue & Evidence */}
                      <td className="px-5 py-4 max-w-xs">
                        {/* Affected Item Details (if attached) */}
                        {hasItem && (
                          <div className="flex items-center gap-2 mb-1.5 p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 max-w-[260px]">
                            {ticket.itemDetails.image ? (
                              <img
                                src={ticket.itemDetails.image}
                                alt={ticket.itemDetails.name}
                                className="w-7 h-7 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                                <Package className="w-3.5 h-3.5 text-slate-500" />
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <p className="text-[11px] font-medium text-slate-700 truncate">
                                {ticket.itemDetails.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {ticket.itemDetails.size ? `Size: ${ticket.itemDetails.size} • ` : ""}
                                {ticket.itemDetails.price ? `₹${ticket.itemDetails.price}` : ""}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Customer Message */}
                        <p className="text-slate-600 line-clamp-2 text-xs leading-relaxed">
                          {ticket.message || <span className="text-slate-400 italic">No text provided</span>}
                        </p>

                        {/* Badges for Order ID & Photos */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {orderIdString && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                              Order #{String(orderIdString).slice(-6).toUpperCase()}
                            </span>
                          )}
                          {hasPhotos && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <Camera className="w-3 h-3" />
                              {ticket.images.length} {ticket.images.length === 1 ? "Photo" : "Photos"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            STATUS_COLORS[ticket.status] || STATUS_COLORS.open
                          }`}
                        >
                          {STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                      </td>

                      {/* Resolution / Admin Action */}
                      <td className="px-5 py-4 max-w-xs">
                        {ticket.status === "resolved" || ticket.status === "closed" ? (
                          <div>
                            {ticket.adminAction && ticket.adminAction !== "none" && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 mb-1">
                                {ACTION_LABELS[ticket.adminAction] || ticket.adminAction}
                              </span>
                            )}
                            <p className="text-[11px] text-slate-600 truncate">
                              {ticket.resolutionNotes || "Marked as resolved"}
                            </p>
                            {ticket.resolvedAt && (
                              <p className="text-[10px] text-slate-400">
                                {formatDate(ticket.resolvedAt)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Pending resolution</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-5 py-4 whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenTicket(ticket)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors border border-sky-200/60"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Resolve
                          </button>

                          {/* Quick inline status dropdown */}
                          <div className="relative">
                            <select
                              value={ticket.status}
                              disabled={updatingId === ticket._id}
                              onChange={(e) => handleStatusChange(ticket._id, e.target.value)}
                              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 px-2.5 py-1.5 pr-6 cursor-pointer hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all disabled:opacity-50"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Page {page} of {pagination.totalPages} ({pagination.total} total tickets)
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TICKET RESOLUTION & INVESTIGATION MODAL ─── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                  #{selectedTicket._id.slice(-4).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">
                      Ticket #{selectedTicket._id.slice(-6).toUpperCase()}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        STATUS_COLORS[selectedTicket.status] || STATUS_COLORS.open
                      }`}
                    >
                      {STATUS_LABELS[selectedTicket.status] || selectedTicket.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Reported on {formatDate(selectedTicket.createdAt)} ({timeAgo(selectedTicket.createdAt)})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="w-8 h-8 rounded-full bg-slate-200/70 text-slate-600 hover:bg-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Row 1: Customer & Order Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Info Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Customer Details</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedTicket.userId?.name || "Customer"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <a
                          href={`tel:${selectedTicket.phone}`}
                          className="text-sky-600 hover:underline"
                        >
                          {selectedTicket.phone}
                        </a>
                        <button
                          onClick={() => handleCopyPhone(selectedTicket.phone)}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                          title="Copy phone"
                        >
                          {copiedPhone ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    {selectedTicket.userId?.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-700">{selectedTicket.userId.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked Order Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                    <span>Linked Order</span>
                  </div>
                  {selectedTicket.orderId ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Order ID:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          #{String(selectedTicket.orderId?._id || selectedTicket.orderId).slice(-6).toUpperCase()}
                        </span>
                      </div>
                      {selectedTicket.orderId?.orderStatus && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Status:</span>
                          <span className="font-semibold text-sky-700 capitalize">
                            {selectedTicket.orderId.orderStatus}
                          </span>
                        </div>
                      )}
                      {selectedTicket.orderId?.totalAmount !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Total:</span>
                          <span className="font-semibold text-slate-800">
                            ₹{selectedTicket.orderId.totalAmount}
                          </span>
                        </div>
                      )}
                      {selectedTicket.orderId?.createdAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Ordered:</span>
                          <span className="text-slate-600">
                            {formatDate(selectedTicket.orderId.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No specific order linked to this ticket.</p>
                  )}
                </div>
              </div>

              {/* Affected Item Details (if reported) */}
              {selectedTicket.itemDetails && selectedTicket.itemDetails.name && (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    <span>Affected Product Item</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedTicket.itemDetails.image ? (
                      <img
                        src={selectedTicket.itemDetails.image}
                        alt={selectedTicket.itemDetails.name}
                        onClick={() => {
                          setLightboxImages([selectedTicket.itemDetails.image]);
                          setLightboxIndex(0);
                        }}
                        className="w-14 h-14 object-cover rounded-xl border border-amber-200 cursor-pointer hover:opacity-90"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {selectedTicket.itemDetails.name}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {selectedTicket.itemDetails.size && (
                          <span className="mr-2 font-medium">Size: {selectedTicket.itemDetails.size}</span>
                        )}
                        {selectedTicket.itemDetails.price && (
                          <span className="font-bold text-slate-800">
                            Price: ₹{selectedTicket.itemDetails.price}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Complaint Message */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Customer Explanation</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      CATEGORY_COLORS[selectedTicket.category] || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedTicket.message || <span className="italic text-slate-400">No message provided.</span>}
                </p>
              </div>

              {/* Photo Evidence Gallery */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Customer Photo Proof ({selectedTicket.images ? selectedTicket.images.length : 0})
                    </span>
                  </div>
                  {selectedTicket.images && selectedTicket.images.length > 0 && (
                    <span className="text-xs text-sky-600 font-medium">Click any photo to enlarge</span>
                  )}
                </div>

                {selectedTicket.images && selectedTicket.images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedTicket.images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setLightboxImages(selectedTicket.images.map((i) => i.url));
                          setLightboxIndex(idx);
                        }}
                        className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-square cursor-pointer bg-slate-100"
                      >
                        <img
                          src={img.url}
                          alt={`Proof ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-5 h-5 drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-400">No photo attachments uploaded with this ticket.</p>
                  </div>
                )}
              </div>

              {/* ─── ISSUE RESOLUTION FORM ─── */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-sky-50/50 to-white border-2 border-sky-100 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Admin Issue Resolution & Customer Notification
                  </h3>
                </div>

                {/* Resolution Status & Action Taken */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Resolution Status
                    </label>
                    <select
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      <option value="open">Open (Unresolved)</option>
                      <option value="in_progress">In Progress (Investigating)</option>
                      <option value="resolved">Resolved (Issue Addressed)</option>
                      <option value="closed">Closed (Finished)</option>
                    </select>
                  </div>

                  {/* Action Taken */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Action Taken
                    </label>
                    <select
                      value={modalAction}
                      onChange={(e) => setModalAction(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      {Object.entries(ACTION_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Templates */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                    Quick Response Templates (Click to fill):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TEMPLATES.map((tmpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setModalAction(tmpl.action);
                          setModalStatus(tmpl.status);
                          setModalNotes(tmpl.text);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white border border-slate-200 text-slate-700 hover:border-sky-300 hover:text-sky-700 transition-colors shadow-2xs"
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution Notes / Response to Customer */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Resolution Notes & Customer Message
                  </label>
                  <textarea
                    rows={4}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder="Describe how the dispute or issue was resolved. This note will be recorded and sent as an in-app push notification to the customer..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-300 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Send className="w-3 h-3 text-sky-500" />
                    Saving this will update the ticket and automatically notify the customer via push notification.
                  </p>
                </div>

                {/* Previous Resolution Stamp (if resolved already) */}
                {selectedTicket.resolvedAt && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span>
                      Previously resolved on {formatDate(selectedTicket.resolvedAt)}
                    </span>
                    <span className="font-semibold">
                      Action: {ACTION_LABELS[selectedTicket.adminAction] || selectedTicket.adminAction}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Close Without Saving
              </button>

              <button
                type="button"
                disabled={savingResolution}
                onClick={handleSaveResolution}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {savingResolution ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Resolution...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Save Resolution & Notify Customer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FULLSCREEN LIGHTBOX ─── */}
      {lightboxImages.length > 0 && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setLightboxImages([])}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {lightboxImages.length > 1 && (
            <>
              <button
                onClick={() =>
                  setLightboxIndex(
                    (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length
                  )
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() =>
                  setLightboxIndex((lightboxIndex + 1) % lightboxImages.length)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={lightboxImages[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            {lightboxImages.length > 1 && (
              <p className="text-white/70 text-xs mt-3">
                {lightboxIndex + 1} of {lightboxImages.length}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
