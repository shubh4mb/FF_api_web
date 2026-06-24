import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/auditLogs';
import toast from 'react-hot-toast';
import {
  Activity,
  Search,
  RefreshCw,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Terminal
} from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activePayload, setActivePayload] = useState(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  
  // Specific ID filters (drill down)
  const [orderId, setOrderId] = useState('');
  const [userId, setUserId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [deliveryRiderId, setDeliveryRiderId] = useState('');

  const actionOptions = [
    { value: 'PAYMENT_INITIATED', label: 'Payment Initiated' },
    { value: 'PAYMENT_SUCCESS', label: 'Payment Success' },
    { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
    { value: 'COURIER_PAYMENT_INITIATED', label: 'Courier Payment Initiated' },
    { value: 'COURIER_PAYMENT_SUCCESS', label: 'Courier Payment Success' },
    { value: 'COURIER_PAYMENT_FAILED', label: 'Courier Payment Failed' },
    { value: 'MERCHANT_REGISTRATION_PAYMENT_INITIATED', label: 'Merchant Reg Initiated' },
    { value: 'MERCHANT_REGISTRATION_PAYMENT_SUCCESS', label: 'Merchant Reg Success' },
    { value: 'MERCHANT_REGISTRATION_PAYMENT_FAILED', label: 'Merchant Reg Failed' },
    { value: 'ORDER_PLACED', label: 'Order Placed' },
    { value: 'COURIER_ORDER_PLACED', label: 'Courier Order Placed' },
    { value: 'ORDER_CANCELLED', label: 'Order Cancelled' },
    { value: 'COURIER_ORDER_CANCELLED', label: 'Courier Order Cancelled' },
    { value: 'ORDER_CANCELLATION_REJECTED', label: 'Cancellation Rejected' },
    { value: 'TRY_PHASE_COMPLETED', label: 'Try Phase Completed' },
    { value: 'ORDER_ASSIGNED', label: 'Order Assigned (Rider)' },
    { value: 'ORDER_REJECTED', label: 'Order Rejected (Rider)' },
    { value: 'ORDER_STATUS_CHANGED', label: 'Order Status Changed' },
    { value: 'COURIER_ORDER_STATUS_CHANGED', label: 'Courier Status Changed' },
    { value: 'WEBHOOK_FAILED', label: 'Webhook Failed' },
  ];

  useEffect(() => {
    fetchLogs();
  }, [page, limit, status, action, orderId, userId, merchantId, deliveryRiderId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const queryParams = {
        page,
        limit,
        status: status || undefined,
        action: action || undefined,
        orderId: orderId || undefined,
        userId: userId || undefined,
        merchantId: merchantId || undefined,
        deliveryRiderId: deliveryRiderId || undefined,
        search: search.trim() || undefined,
      };

      const response = await getAuditLogs(queryParams);
      if (response?.success) {
        setLogs(response.logs || []);
        setTotalLogs(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
      } else {
        toast.error('Failed to retrieve logs');
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const clearAllFilters = () => {
    setSearch('');
    setStatus('');
    setAction('');
    setOrderId('');
    setUserId('');
    setMerchantId('');
    setDeliveryRiderId('');
    setPage(1);
  };

  const getStatusBadge = (statusValue) => {
    switch (statusValue) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Success
          </span>
        );
      case 'failure':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-full animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Failure
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 rounded-full">
            <Info className="w-3.5 h-3.5" />
            Info
          </span>
        );
    }
  };

  const getActionBadge = (actionValue) => {
    if (actionValue.includes('PAYMENT_SUCCESS') || actionValue.includes('REGISTRATION_PAYMENT_SUCCESS')) {
      return <span className="text-xs font-mono font-bold px-2 py-1 bg-emerald-100 text-emerald-800 rounded">{actionValue}</span>;
    }
    if (actionValue.includes('FAILED')) {
      return <span className="text-xs font-mono font-bold px-2 py-1 bg-rose-100 text-rose-800 rounded">{actionValue}</span>;
    }
    if (actionValue.includes('INITIATED')) {
      return <span className="text-xs font-mono font-bold px-2 py-1 bg-sky-100 text-sky-800 rounded">{actionValue}</span>;
    }
    if (actionValue.includes('CANCELLED')) {
      return <span className="text-xs font-mono font-bold px-2 py-1 bg-slate-100 text-slate-800 rounded">{actionValue}</span>;
    }
    return <span className="text-xs font-mono font-bold px-2 py-1 bg-slate-100 text-slate-700 rounded">{actionValue}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-sky-500" />
            System Transaction & Audit Logs
          </h1>
          <p className="text-slate-500 mt-1">Track orders, payments, webhooks, and status history for complete traceability</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {(status || action || orderId || userId || merchantId || deliveryRiderId || search) && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-all"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search log messages, actions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent text-sm bg-slate-50/50"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Status filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm bg-white"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="pending">Pending</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Action Category</label>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm bg-white"
            >
              <option value="">All Actions</option>
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Page size select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Logs per page</label>
            <select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm bg-white"
            >
              <option value={10}>10 Logs</option>
              <option value={25}>25 Logs</option>
              <option value={50}>50 Logs</option>
              <option value={100}>100 Logs</option>
            </select>
          </div>

          {/* Filter Status summary info */}
          <div className="flex items-end justify-start md:justify-end">
            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-2.5 w-full md:w-auto text-center md:text-right">
              Total Found: <span className="font-bold text-slate-800">{totalLogs}</span> entries
            </div>
          </div>
        </div>

        {/* Drill-down chips */}
        {(orderId || userId || merchantId || deliveryRiderId) && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-slate-400">Drill-down filters:</span>
            {orderId && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-xs font-medium">
                Order ID: #{orderId.slice(-6)}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-sky-900" onClick={() => setOrderId('')} />
              </span>
            )}
            {userId && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium">
                User ID: #{userId.slice(-6)}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-indigo-900" onClick={() => setUserId('')} />
              </span>
            )}
            {merchantId && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium">
                Merchant ID: #{merchantId.slice(-6)}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-amber-900" onClick={() => setMerchantId('')} />
              </span>
            )}
            {deliveryRiderId && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-medium">
                Rider ID: #{deliveryRiderId.slice(-6)}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-teal-900" onClick={() => setDeliveryRiderId('')} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="w-full flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-10 h-10 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-semibold">Loading system audit records...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="w-full text-center py-20 bg-slate-50 border border-slate-200 rounded-2xl p-12">
          <Info className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">No logs found</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">There are no audit log entries matching the selected filter criteria. Try broadening your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs border-b font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Message</th>
                  <th className="px-6 py-4">Refs (User/Merchant/Rider)</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {logs.map((log) => {
                  const refOrder = log.orderId || log.courierOrderId;
                  const isCourier = !!log.courierOrderId;
                  
                  return (
                    <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>

                      {/* Message */}
                      <td className="px-6 py-4 max-w-xs md:max-w-md">
                        <div className="font-medium text-slate-800 leading-normal">{log.message}</div>
                        {refOrder && (
                          <div className="mt-1.5 flex gap-2 flex-wrap items-center">
                            <span 
                              onClick={() => {
                                isCourier ? setCourierOrderId(refOrder._id) : setOrderId(refOrder._id);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700 px-2 py-0.5 rounded cursor-pointer transition-all border border-slate-200"
                            >
                              {isCourier ? 'Courier' : 'Order'} #{refOrder._id.slice(-5).toUpperCase()}
                            </span>
                            {refOrder.razorpayOrderId && (
                              <span className="text-[10px] font-mono text-slate-400">
                                RZP: {refOrder.razorpayOrderId}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* References */}
                      <td className="px-6 py-4 text-xs text-slate-500 space-y-1">
                        {log.userId && (
                          <div 
                            onClick={() => setUserId(log.userId._id)}
                            className="flex items-center gap-1 hover:text-indigo-600 cursor-pointer font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                            <span className="underline">Customer: {log.userId.name}</span>
                          </div>
                        )}
                        {log.merchantId && (
                          <div 
                            onClick={() => setMerchantId(log.merchantId._id)}
                            className="flex items-center gap-1 hover:text-amber-600 cursor-pointer font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            <span className="underline">Shop: {log.merchantId.shopName}</span>
                          </div>
                        )}
                        {log.deliveryRiderId && (
                          <div 
                            onClick={() => setDeliveryRiderId(log.deliveryRiderId._id)}
                            className="flex items-center gap-1 hover:text-teal-600 cursor-pointer font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                            <span className="underline">Rider: {log.deliveryRiderId.name}</span>
                          </div>
                        )}
                        {log.adminId && (
                          <div className="flex items-center gap-1 font-semibold text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                            <span>Admin: {log.adminId.name} ({log.adminId.role})</span>
                          </div>
                        )}
                        {!log.userId && !log.merchantId && !log.deliveryRiderId && !log.adminId && (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600">
                        {log.details ? (
                          <button
                            onClick={() => setActivePayload(log)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold rounded-lg text-slate-700 transition-all shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Payload
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No Payload</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Showing page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span> ({limit} logs/page)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all shadow-sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Payload Inspection Modal */}
      {activePayload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 text-slate-100 w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-slate-200">
                  Payload Metadata Viewer
                </h3>
              </div>
              <button
                onClick={() => setActivePayload(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Header */}
            <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 text-xs text-slate-400 flex flex-wrap gap-x-6 gap-y-1.5 font-mono">
              <div>
                <span className="text-slate-500">Action:</span> {activePayload.action}
              </div>
              <div>
                <span className="text-slate-500">Log ID:</span> {activePayload._id}
              </div>
              <div>
                <span className="text-slate-500">Date:</span> {new Date(activePayload.createdAt).toLocaleString()}
              </div>
              {activePayload.ipAddress && (
                <div>
                  <span className="text-slate-500">IP:</span> {activePayload.ipAddress}
                </div>
              )}
            </div>

            {/* Modal Body (Code Block) */}
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs bg-slate-950 custom-scrollbar leading-relaxed">
              <pre className="text-sky-300">
                {JSON.stringify(activePayload.details, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end bg-slate-900">
              <button
                onClick={() => setActivePayload(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
