import React, { useState, useEffect } from 'react';
import { getUnresponsiveRiderReports, resolveUnresponsiveRider } from '../../api/orders';
import toast from 'react-hot-toast';
import { AlertCircle, Check, X, ShieldAlert, Clock, RefreshCw } from 'lucide-react';

const UnresponsiveRiderReports = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getUnresponsiveRiderReports();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load unresponsive rider reports:', error);
      toast.error('Failed to load unresponsive rider reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (orderId, action) => {
    const actionText = action === 'cancel_order' ? 'cancel the order and refund the user' : 'dismiss the report';
    if (!window.confirm(`Are you sure you want to ${actionText}?`)) {
      return;
    }

    try {
      await resolveUnresponsiveRider(orderId, action);
      toast.success(`Report ${action === 'cancel_order' ? 'resolved and order cancelled' : 'dismissed'} successfully.`);
      fetchRequests();
    } catch (error) {
      console.error(`Failed to ${action} report:`, error);
      toast.error(`Failed to process action: ${error.response?.data?.message || error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7 text-rose-500" />
            Unresponsive Rider Reports
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Review reports from customers or merchants regarding unresponsive riders.</p>
        </div>
        <button
          onClick={fetchRequests}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="w-full flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Loading cancellation requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto mt-8">
          <Check className="w-12 h-12 text-emerald-500 mx-auto mb-4 bg-emerald-100 p-2.5 rounded-full" />
          <h3 className="text-lg font-bold text-slate-800">All Clean!</h3>
          <p className="text-slate-500 mt-2">There are currently no pending unresponsive rider reports.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b font-semibold">
                  <th className="px-6 py-4">Order Details</th>
                  <th className="px-6 py-4">Merchant</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Report Info</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Order Details */}
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-bold text-slate-700 uppercase">
                        #{order._id.slice(-5)}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(order.updatedAt).toLocaleString()}
                      </div>
                    </td>

                    {/* Merchant */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {order.merchantId?.shopName || 'N/A'}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium">
                        {order.userId?.name || 'Customer'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {order.userId?.phone || 'No Phone'}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900">
                        ₹{order.totalAmount || 0}
                      </span>
                    </td>

                    {/* Report Info */}
                    <td className="px-6 py-4">
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 max-w-xs flex flex-col gap-2">
                        <div className="flex gap-2 items-center">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="text-xs text-rose-700 font-bold capitalize">
                            Reported by: {order.riderUnresponsiveReport?.reporter}
                          </span>
                        </div>
                        <span className="text-xs text-rose-600 leading-normal">
                          Timestamp: {new Date(order.riderUnresponsiveReport?.timestamp).toLocaleString()}
                        </span>
                        {order.deliveryRiderDetails && (
                          <div className="mt-1 pt-1 border-t border-rose-200">
                            <span className="text-xs text-rose-700 block">Rider: {order.deliveryRiderDetails.name}</span>
                            <span className="text-xs text-rose-700 block font-semibold">{order.deliveryRiderDetails.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col justify-end gap-2 items-end">
                        <button
                          onClick={() => handleAction(order._id, 'cancel_order')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-all w-full justify-center sm:w-auto"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Cancel Order (Refund)
                        </button>
                        <button
                          onClick={() => handleAction(order._id, 'dismiss')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold transition-all w-full justify-center sm:w-auto"
                        >
                          <X className="w-3.5 h-3.5" />
                          Dismiss Report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnresponsiveRiderReports;
