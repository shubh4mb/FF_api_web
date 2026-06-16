import React, { useEffect, useState } from "react";
import { getSupportTickets, updateTicketStatus, getSupportStats } from "../../api/support";
import { MessageSquare, Clock, CheckCircle, AlertCircle, Filter, RefreshCw, ChevronDown } from "lucide-react";

const CATEGORY_LABELS = {
  order_delayed: "Order Delayed",
  return_issue: "Return Issue",
  try_buy_issue: "Try & Buy Issue",
  refund_issue: "Refund Issue",
  wrong_product: "Wrong Product",
  size_exchange: "Size Exchange",
  merchant_issue: "Merchant Issue",
  report_bug: "Report a Bug",
  other: "Other",
};

const STATUS_COLORS = {
  open: "bg-red-50 text-red-700 border-red-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [updatingId, setUpdatingId] = useState(null);

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

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await updateTicketStatus(id, newStatus);
      setTickets((prev) =>
        prev.map((t) => (t._id === id ? { ...t, status: newStatus } : t))
      );
      fetchStats();
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr) => {
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Support Tickets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor customer support requests triggered from the app
          </p>
        </div>
        <button
          onClick={() => { fetchTickets(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Total</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-sm font-medium text-red-500">Open</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.open}</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-amber-500">In Progress</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-emerald-500">Resolved</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.resolved}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-slate-400" />
        {["", "open", "in_progress", "resolved", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === s
                ? "bg-sky-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s ? STATUS_LABELS[s] : "All"}
          </button>
        ))}
      </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No support tickets found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                  Customer
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                  Category
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                  Message
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                  Time
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket._id}
                  className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-slate-800">
                      {ticket.userId?.name || "Unknown"}
                    </div>
                    <div className="text-xs text-slate-400">{ticket.phone || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {CATEGORY_LABELS[ticket.category] || ticket.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600 max-w-xs truncate">
                      {ticket.message || "—"}
                    </p>
                    {ticket.orderId && (
                      <p className="text-xs text-sky-500 mt-0.5">
                        Order: {ticket.orderId._id?.toString().slice(-6) || "—"}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-700">{timeAgo(ticket.createdAt)}</div>
                    <div className="text-xs text-slate-400">{formatDate(ticket.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                        STATUS_COLORS[ticket.status] || STATUS_COLORS.open
                      }`}
                    >
                      {STATUS_LABELS[ticket.status] || ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative">
                      <select
                        value={ticket.status}
                        disabled={updatingId === ticket._id}
                        onChange={(e) => handleStatusChange(ticket._id, e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 px-3 py-1.5 pr-7 cursor-pointer hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all disabled:opacity-50"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing page {page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-all"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
