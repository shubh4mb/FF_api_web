import React, { useState, useEffect } from 'react';
import {
  getAllWarehouseOrders,
  getWarehouseOrderStats,
  settleWarehouseOrder,
  updateWarehouseOrderStatus,
  acceptWarehouseOrderAdmin,
  rejectWarehouseOrderAdmin,
  packWarehouseOrderAdmin,
  getAllWarehouses
} from '@/api/warehouse';
import { toast } from 'react-hot-toast';
import { ShoppingCart, DollarSign, Percent, ShieldCheck, Clock, User, Phone, MapPin, Truck, RefreshCw, Key, CheckCircle, XCircle, PackageCheck } from 'lucide-react';

const WarehouseOrders = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalCommission: 0,
    totalMerchantPayout: 0,
    pendingSettlements: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState('');

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await getAllWarehouses({ isActive: true });
      const whs = res.data?.warehouses || [];
      setWarehouses(whs);
      if (whs.length > 0) {
        setSelectedWarehouseId(whs[0]._id);
        fetchOrdersAndStats(whs[0]._id);
      }
    } catch (error) {
      toast.error('Failed to fetch warehouses');
    }
  };

  const fetchOrdersAndStats = async (whId) => {
    if (!whId) return;
    setLoading(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        getAllWarehouseOrders({ warehouseId: whId }),
        getWarehouseOrderStats({ warehouseId: whId })
      ]);
      setOrders(ordersRes.data?.orders || []);
      setStats(statsRes.data?.stats || {
        totalOrders: 0,
        totalRevenue: 0,
        totalCommission: 0,
        totalMerchantPayout: 0,
        pendingSettlements: 0
      });
    } catch (error) {
      toast.error('Failed to fetch orders or stats');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = (e) => {
    const whId = e.target.value;
    setSelectedWarehouseId(whId);
    fetchOrdersAndStats(whId);
    setSelectedOrder(null);
  };

  const handleAdminAccept = async (orderId) => {
    try {
      const res = await acceptWarehouseOrderAdmin(orderId);
      toast.success(res.message || 'Order accepted and queued for rider');
      fetchOrdersAndStats(selectedWarehouseId);
      if (selectedOrder?._id === orderId) {
        setSelectedOrder(res.order || { ...selectedOrder, orderStatus: 'accepted', deliveryRiderStatus: 'queued' });
        setStatusUpdate('accepted');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept order');
    }
  };

  const handleAdminReject = async (orderId) => {
    const reason = window.prompt("Reason for rejection:");
    if (reason === null) return;
    try {
      const res = await rejectWarehouseOrderAdmin(orderId, reason);
      toast.success(res.message || 'Order rejected and refunded');
      fetchOrdersAndStats(selectedWarehouseId);
      if (selectedOrder?._id === orderId) {
        setSelectedOrder(res.order || { ...selectedOrder, orderStatus: 'rejected' });
        setStatusUpdate('rejected');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject order');
    }
  };

  const handleAdminPack = async (orderId) => {
    try {
      const res = await packWarehouseOrderAdmin(orderId);
      toast.success(`Order packed! Pickup OTP: ${res.otp}`);
      fetchOrdersAndStats(selectedWarehouseId);
      if (selectedOrder?._id === orderId) {
        setSelectedOrder(res.order || { ...selectedOrder, orderStatus: 'packed', otp: res.otp });
        setStatusUpdate('packed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to pack order');
    }
  };

  const handleSettle = async (orderId) => {
    try {
      const res = await settleWarehouseOrder(orderId);
      toast.success(res.message || 'Payout settled successfully');
      fetchOrdersAndStats(selectedWarehouseId);
      if (selectedOrder?._id === orderId) {
        setSelectedOrder(prev => ({ ...prev, settlementStatus: 'settled' }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Settlement failed');
    }
  };

  const handleStatusChangeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await updateWarehouseOrderStatus(selectedOrder._id, { orderStatus: statusUpdate });
      toast.success('Order status updated');
      fetchOrdersAndStats(selectedWarehouseId);
      setSelectedOrder(prev => ({ ...prev, orderStatus: statusUpdate }));
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warehouse Orders & Settlements</h1>
          <p className="text-slate-500 text-sm mt-1">Track orders, manage rider/courier statuses, and settle merchant payouts.</p>
        </div>
        <select
          value={selectedWarehouseId}
          onChange={handleWarehouseChange}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white w-full md:w-auto"
        >
          <option value="">Select Warehouse...</option>
          {warehouses.map((wh) => (
            <option key={wh._id} value={wh._id}>
              {wh.name} ({wh.code})
            </option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-50 text-sky-500 shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{stats.totalOrders}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Orders</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-500 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">₹{stats.totalRevenue}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Revenue</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-500 shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">₹{stats.totalCommission}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">FF Commission</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-50 text-violet-500 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">₹{stats.totalMerchantPayout}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Merchant Payout</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-500 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{stats.pendingSettlements}</div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Unsettled</div>
          </div>
        </div>
      </div>

      {/* Detail Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Order List */}
        <div className="xl:col-span-2 space-y-4">
          {loading ? (
            <div className="flex justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
              <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="font-medium text-slate-700">No orders logged from this warehouse</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Fulfillment</th>
                      <th className="p-4">Total Amount</th>
                      <th className="p-4">Order Status</th>
                      <th className="p-4">Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((ord) => (
                      <tr
                        key={ord._id}
                        onClick={() => {
                          setSelectedOrder(ord);
                          setStatusUpdate(ord.orderStatus);
                        }}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${
                          selectedOrder?._id === ord._id ? 'bg-sky-50/30' : ''
                        }`}
                      >
                        <td className="p-4 font-mono font-semibold text-slate-700">
                          {ord._id.slice(-6).toUpperCase()}
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-slate-800">{ord.userId?.name || 'User'}</div>
                          <div className="text-xs text-slate-400">{ord.userId?.phone}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                            ord.fulfillmentType === 'try_and_buy' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {ord.fulfillmentType === 'try_and_buy' ? 'Try & Buy' : 'Courier'}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          ₹{ord.totalAmount}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            ord.orderStatus === 'completed' || ord.orderStatus === 'delivered'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ord.orderStatus === 'cancelled'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {ord.orderStatus}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            ord.settlementStatus === 'settled' ? 'text-emerald-600' : 'text-slate-400'
                          }`}>
                            {ord.settlementStatus === 'settled' ? 'Settled' : 'Unsettled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Selected Order Details */}
        <div className="xl:col-span-1">
          {selectedOrder ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 sticky top-24">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800">Order #{selectedOrder._id.slice(-6).toUpperCase()}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedOrder._id}</p>
                </div>
                {selectedOrder.settlementStatus === 'unsettled' && 
                  ['completed', 'delivered', 'selection_made'].includes(selectedOrder.orderStatus) && (
                    <button
                      onClick={() => handleSettle(selectedOrder._id)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition-colors"
                    >
                      Settle Payout
                    </button>
                )}
              </div>

              {/* Quick Lifecycle Actions */}
              {selectedOrder.orderStatus === 'placed' && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-500">Quick Actions</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdminAccept(selectedOrder._id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={14} /> Accept & Queue Rider
                    </button>
                    <button
                      onClick={() => handleAdminReject(selectedOrder._id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs px-3 py-2 rounded-xl font-bold transition-all border border-rose-200 flex items-center gap-1"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}

              {selectedOrder.orderStatus === 'accepted' && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => handleAdminPack(selectedOrder._id)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <PackageCheck size={16} /> Pack Order & Generate Pickup OTP
                  </button>
                </div>
              )}

              {/* Pickup OTP Banner */}
              {selectedOrder.otp && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Pickup OTP</span>
                      <p className="text-xl font-mono font-bold text-amber-950 tracking-widest leading-none mt-0.5">{selectedOrder.otp}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-amber-700 bg-amber-100/70 px-2 py-1 rounded-md font-medium">Verify on pickup</span>
                </div>
              )}

              {/* Status Update Form */}
              <form onSubmit={handleStatusChangeSubmit} className="flex gap-2">
                <select
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                >
                  <option value="placed">Placed</option>
                  <option value="accepted">Accepted</option>
                  <option value="packed">Packed</option>
                  <option value="in_transit">In Transit</option>
                  <option value="try_phase">Try Phase</option>
                  <option value="selection_made">Selection Made</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                >
                  Update
                </button>
              </form>

              {/* Delivery Rider Card */}
              {(selectedOrder.deliveryRiderDetails?.name || selectedOrder.deliveryRiderId || selectedOrder.deliveryRiderStatus) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Rider</h4>
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{selectedOrder.deliveryRiderDetails?.name || (selectedOrder.deliveryRiderId ? 'Assigned Rider' : 'Unassigned')}</p>
                        {selectedOrder.deliveryRiderDetails?.phone && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone size={11} /> {selectedOrder.deliveryRiderDetails.phone}
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-sky-100 text-sky-700">
                        {selectedOrder.deliveryRiderStatus?.replace(/_/g, ' ') || 'unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</h4>
                <div className="flex gap-2.5 text-slate-700 text-sm">
                  <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{selectedOrder.userId?.name || 'Anonymous'}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {selectedOrder.userId?.phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Location</h4>
                <div className="flex gap-2.5 text-slate-700 text-sm">
                  <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{selectedOrder.deliveryLocation?.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedOrder.deliveryLocation?.street || selectedOrder.deliveryLocation?.addressLine1}, {selectedOrder.deliveryLocation?.city}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Items</h4>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex gap-3 py-2 text-sm items-center">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-10 h-10 object-cover rounded border border-slate-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400">Size: {item.size} • Qty: {item.quantity}</p>
                      </div>
                      <div className="font-semibold text-slate-700">₹{item.price}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdowns */}
              <div className="border-t border-slate-100 pt-4 space-y-1.5 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium">₹{selectedOrder.totalAmount}</span>
                </div>
                <div className="flex justify-between text-indigo-600 font-medium">
                  <span>FF Commission ({selectedOrder.commissionRate}%)</span>
                  <span>-₹{selectedOrder.commissionAmount}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-800">
                  <span>Merchant Payout</span>
                  <span>₹{selectedOrder.merchantPayout}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 border-dashed p-12 text-center text-slate-400 sticky top-24">
              <Truck className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">Select an order from the list to view full details and process settlements.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarehouseOrders;
