import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLiveAdminOrders, getAdminOrderById } from '@/api/orders';
import { getMerchants } from '@/api/merchants';
import { useAdminOrderSocket } from '@/hooks/useAdminOrderSocket';
import soundAlert from '@/utils/soundAlert';
import { toast } from 'react-hot-toast';
import {
  Radio,
  Volume2,
  VolumeX,
  Bell,
  RefreshCw,
  Search,
  Store,
  Clock,
  User,
  Phone,
  MapPin,
  ShoppingBag,
  Truck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Filter,
  Package,
  Calendar,
  Sparkles,
  Eye,
  X,
  ShieldCheck,
  CreditCard,
  KeyRound,
  Store as StoreIcon
} from 'lucide-react';

const ORDER_STATUS_CONFIG = {
  placed: {
    label: 'Placed (New)',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    dotBg: 'bg-amber-500 animate-pulse',
    description: 'Awaiting merchant acceptance',
  },
  accepted: {
    label: 'Accepted',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    dotBg: 'bg-blue-500',
    description: 'Merchant accepted, preparing',
  },
  packed: {
    label: 'Packed',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    dotBg: 'bg-purple-500',
    description: 'Packed, awaiting rider pickup',
  },
  in_transit: {
    label: 'In Transit',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    dotBg: 'bg-sky-500 animate-pulse',
    description: 'Rider en route to customer',
  },
  try_phase: {
    label: 'Try Phase',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotBg: 'bg-indigo-500 animate-pulse',
    description: 'Customer is trying items',
  },
  selection_made: {
    label: 'Selection Made',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
    dotBg: 'bg-teal-500',
    description: 'Selection made & payment settled',
  },
  return_in_progress: {
    label: 'Return in Progress',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200',
    dotBg: 'bg-orange-500',
    description: 'Rider returning items to store',
  },
  completed: {
    label: 'Completed',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotBg: 'bg-emerald-500',
    description: 'Order successfully delivered',
  },
  cancelled: {
    label: 'Cancelled',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
    dotBg: 'bg-rose-500',
    description: 'Order was cancelled',
  },
  rejected: {
    label: 'Rejected',
    badgeBg: 'bg-red-100 text-red-800 border-red-200',
    dotBg: 'bg-red-500',
    description: 'Rejected by merchant',
  },
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const LiveOrders = () => {
  const [orders, setOrders] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    todayOrders: 0,
    placedOrders: 0,
    preparingOrders: 0,
    inTransitOrders: 0,
    completedToday: 0,
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSoundOn, setIsSoundOn] = useState(() => soundAlert.isSoundEnabled());
  const [copiedId, setCopiedId] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState(new Set());
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Copy order ID helper
  const handleCopyId = (e, orderId) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(orderId));
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Sound toggle
  const handleToggleSound = () => {
    const newState = soundAlert.toggleSound();
    setIsSoundOn(newState);
    if (newState) {
      soundAlert.playNewOrderSound(true);
      toast.success('Sound alerts enabled');
    } else {
      toast('Sound alerts muted', { icon: '🔇' });
    }
  };

  const handleTestSound = () => {
    soundAlert.playNewOrderSound(true);
    toast.success('Playing alert chime');
  };

  // Fetch all registered merchants
  const fetchMerchantsList = useCallback(async () => {
    try {
      const res = await getMerchants();
      const list = Array.isArray(res) ? res : res.data || res.merchants || [];
      setMerchants(list);
    } catch (err) {
      console.error('Failed to fetch merchants:', err);
    }
  }, []);

  // Fetch initial orders & stats from backend
  const fetchOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = {
        limit: 100,
        merchantId: selectedMerchantId,
        status: selectedStatus,
        search: searchQuery.trim() || undefined,
      };
      const res = await getLiveAdminOrders(params);
      const fetchedOrders = res.orders || res.data?.orders || [];
      setOrders(fetchedOrders);
      if (res.summary) {
        setSummary(res.summary);
      }
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      toast.error('Failed to load orders feed');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedMerchantId, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchMerchantsList();
  }, [fetchMerchantsList]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle new incoming order from Socket.IO
  const handleIncomingNewOrder = useCallback((newOrderData) => {
    if (!newOrderData || !newOrderData._id) return;

    // 1. Play audio chime
    soundAlert.playNewOrderSound();

    // 2. Resolve merchant shop name
    const mId = newOrderData.merchantId?._id || newOrderData.merchantId;
    const matchedMerchant = merchants.find(m => String(m._id) === String(mId));
    const merchantName =
      newOrderData.merchantId?.shopName ||
      newOrderData.merchantDetails?.name ||
      matchedMerchant?.shopName ||
      'Merchant Partner';

    const shortId = String(newOrderData._id).slice(-5).toUpperCase();
    const amount = newOrderData.totalAmount || newOrderData.finalBilling?.totalPayable || 0;

    // 3. Show rich toast alert
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-slate-900 border-2 border-emerald-500 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4 text-white gap-3 items-start`}
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
          <ShoppingBag className="w-5 h-5 animate-bounce" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">New Order Placed!</span>
            <span className="text-xs text-slate-400">#{shortId}</span>
          </div>
          <div className="text-sm font-bold text-white mt-0.5 truncate">{merchantName}</div>
          <div className="text-xs text-slate-300 mt-1">
            Total: <span className="font-semibold text-emerald-400">₹{amount}</span> • {newOrderData.items?.length || 1} item(s)
          </div>
        </div>
        <button
          onClick={() => {
            toast.dismiss(t.id);
            setSelectedOrder(newOrderData);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs py-1.5 px-3 rounded-lg transition-colors self-center shrink-0"
        >
          View
        </button>
      </div>
    ), { duration: 8000 });

    // 4. Highlight the order card
    const orderIdStr = String(newOrderData._id);
    setHighlightedOrderIds((prev) => new Set(prev).add(orderIdStr));
    setTimeout(() => {
      setHighlightedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderIdStr);
        return next;
      });
    }, 15000);

    // 5. Prepend or update in state
    setOrders((prev) => {
      const existsIndex = prev.findIndex(o => String(o._id) === orderIdStr);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = { ...updated[existsIndex], ...newOrderData };
        return updated;
      }
      return [newOrderData, ...prev];
    });

    // 6. Update summary counters
    setSummary((prev) => ({
      ...prev,
      todayOrders: prev.todayOrders + 1,
      placedOrders: prev.placedOrders + 1,
    }));
  }, [merchants]);

  // Handle real-time status update from Socket.IO
  const handleIncomingOrderUpdate = useCallback((updatePayload) => {
    if (!updatePayload || !updatePayload._id) return;
    const updateId = String(updatePayload._id);

    setOrders((prev) =>
      prev.map((ord) => {
        if (String(ord._id) === updateId) {
          return { ...ord, ...updatePayload };
        }
        return ord;
      })
    );

    if (selectedOrder && String(selectedOrder._id) === updateId) {
      setSelectedOrder((prev) => ({ ...prev, ...updatePayload }));
    }
  }, [selectedOrder]);

  // Initialize Socket connection
  const { isConnected, isConnecting, reconnect, lastEventTime } = useAdminOrderSocket({
    onNewOrder: handleIncomingNewOrder,
    onOrderUpdate: handleIncomingOrderUpdate,
  });

  // Calculate per-merchant order counts
  const merchantOrderCounts = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      const mId = String(o.merchantId?._id || o.merchantId || '');
      if (mId) {
        counts[mId] = (counts[mId] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Merchant filter
      if (selectedMerchantId !== 'all') {
        const orderMerchantId = String(order.merchantId?._id || order.merchantId || '');
        if (orderMerchantId !== selectedMerchantId) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (order.orderStatus !== selectedStatus) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const shortId = String(order._id || '').slice(-5).toLowerCase();
        const fullId = String(order._id || '').toLowerCase();
        const custName = (order.userId?.name || order.deliveryLocation?.name || '').toLowerCase();
        const custPhone = (order.userId?.phoneNumber || order.deliveryLocation?.phone || '').toLowerCase();
        const merchName = (order.merchantId?.shopName || order.merchantDetails?.name || '').toLowerCase();
        const itemNames = (order.items || []).map(i => (i.name || '').toLowerCase()).join(' ');

        if (
          !shortId.includes(q) &&
          !fullId.includes(q) &&
          !custName.includes(q) &&
          !custPhone.includes(q) &&
          !merchName.includes(q) &&
          !itemNames.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [orders, selectedMerchantId, selectedStatus, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── HEADER & LIVE RADAR STATUS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Radio className="w-6 h-6 animate-pulse text-white" />
            </div>
            {isConnected && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white">
                Live Order Radar
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs lg:text-sm text-slate-400 mt-1">
              Real-time socket monitoring across all active merchant stores
            </p>
          </div>
        </div>

        {/* Controls: Connection Pill + Sound Toggle + Manual Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Socket Connection Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isConnecting
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : isConnecting
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            <span>
              {isConnected ? 'Socket Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
            {!isConnected && !isConnecting && (
              <button
                onClick={reconnect}
                className="ml-1 text-[11px] underline hover:text-white transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Sound Toggle Button */}
          <button
            onClick={handleToggleSound}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              isSoundOn
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
            title={isSoundOn ? 'Mute incoming order alerts' : 'Enable sound notifications'}
          >
            {isSoundOn ? <Volume2 size={16} className="text-sky-400" /> : <VolumeX size={16} />}
            <span>{isSoundOn ? 'Sound Alerts ON' : 'Muted'}</span>
          </button>

          {/* Test Sound Button */}
          <button
            onClick={handleTestSound}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Test alert chime"
          >
            <Bell size={16} />
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchOrders(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Refresh order feed"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── TOP METRIC SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        {/* Metric 1: Placed / New Orders */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Awaiting Action</span>
            <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black text-sm">
              ⚡
            </span>
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-black text-amber-900">
            {summary.placedOrders}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
            Needs merchant acceptance
          </div>
        </div>

        {/* Metric 2: Today's Orders */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Today's Orders</span>
            <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ShoppingBag size={18} />
            </span>
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-black text-blue-900">
            {summary.todayOrders}
          </div>
          <div className="text-[11px] text-blue-700 font-medium mt-1">
            Total placed today
          </div>
        </div>

        {/* Metric 3: In Prep / Packing */}
        <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Preparing & Packed</span>
            <span className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Package size={18} />
            </span>
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-black text-purple-900">
            {summary.preparingOrders}
          </div>
          <div className="text-[11px] text-purple-700 font-medium mt-1">
            Accepted / packing for rider
          </div>
        </div>

        {/* Metric 4: In Transit / Out */}
        <div className="bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">On Delivery / Try</span>
            <span className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <Truck size={18} />
            </span>
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-black text-sky-900">
            {summary.inTransitOrders}
          </div>
          <div className="text-[11px] text-sky-700 font-medium mt-1">
            Rider on road / trial active
          </div>
        </div>

        {/* Metric 5: Active Merchants */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Merchant Stores</span>
            <span className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
              <StoreIcon size={18} />
            </span>
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">
            {merchants.length || 4}
          </div>
          <div className="text-[11px] text-slate-600 font-medium mt-1">
            Monitored on this screen
          </div>
        </div>
      </div>

      {/* ── 4 MERCHANTS QUICK SWITCHER SELECTOR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Filter by Merchant Store ({merchants.length} Active Stores)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Click any merchant to view only their orders, or select All
          </span>
        </div>

        {/* Horizontal Merchant Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {/* "All Merchants" button */}
          <button
            onClick={() => setSelectedMerchantId('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
              selectedMerchantId === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <StoreIcon size={14} />
            <span>All Merchants</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                selectedMerchantId === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {orders.length}
            </span>
          </button>

          {/* Individual Merchant Buttons */}
          {merchants.map((merchant) => {
            const count = merchantOrderCounts[String(merchant._id)] || 0;
            const isSelected = selectedMerchantId === String(merchant._id);

            return (
              <button
                key={merchant._id}
                onClick={() => setSelectedMerchantId(String(merchant._id))}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                  isSelected
                    ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {/* Store logo or fallback icon */}
                {merchant.logo?.url ? (
                  <img
                    src={merchant.logo.url}
                    alt={merchant.shopName}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                      isSelected ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {merchant.shopName ? merchant.shopName[0].toUpperCase() : 'M'}
                  </span>
                )}

                <span className="truncate max-w-[140px]">{merchant.shopName || 'Store'}</span>

                {/* Badge count */}
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    isSelected
                      ? 'bg-sky-600 text-white'
                      : count > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEARCH & STATUS FILTERS ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID (#short or full), customer name, phone, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 shrink-0 self-center">
            Showing <span className="font-bold text-slate-800">{filteredOrders.length}</span> of {orders.length} orders
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'placed', label: 'Placed (New)', badge: summary.placedOrders },
            { id: 'accepted', label: 'Accepted' },
            { id: 'packed', label: 'Packed' },
            { id: 'in_transit', label: 'In Transit' },
            { id: 'try_phase', label: 'Try Phase' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                selectedStatus === tab.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    selectedStatus === tab.id ? 'bg-amber-400 text-slate-900' : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── ORDERS FEED / LIST VIEW ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
          <span className="text-sm font-semibold">Loading orders stream...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-700">No orders found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No orders matching "${searchQuery}". Try clearing search filter.`
              : selectedStatus !== 'all' || selectedMerchantId !== 'all'
              ? 'No orders matching current filter criteria.'
              : 'As soon as an order is placed on any of the 4 merchant stores, it will automatically appear here via socket stream!'}
          </p>
          {(searchQuery || selectedStatus !== 'all' || selectedMerchantId !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedMerchantId('all');
              }}
              className="mt-2 text-xs font-bold text-sky-600 hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => {
            const orderIdStr = String(order._id);
            const isHighlighted = highlightedOrderIds.has(orderIdStr);
            const shortId = orderIdStr.slice(-5).toUpperCase();
            const statusConfig = ORDER_STATUS_CONFIG[order.orderStatus] || {
              label: order.orderStatus || 'Unknown',
              badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
              dotBg: 'bg-slate-400',
            };

            const merchantName =
              order.merchantId?.shopName ||
              order.merchantDetails?.name ||
              order.warehouseId?.name ||
              'Merchant Partner';

            const customerName = order.userId?.name || order.deliveryLocation?.name || 'Customer';
            const customerPhone = order.userId?.phoneNumber || order.deliveryLocation?.phone || '';
            const deliveryAddress =
              order.deliveryLocation?.addressLine1 ||
              order.deliveryLocation?.street ||
              order.deliveryLocation?.city ||
              'Customer Delivery Address';

            const itemsCount = (order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
            const totalAmount = order.finalBilling?.totalPayable ?? order.totalAmount ?? 0;

            return (
              <div
                key={order._id}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative ${
                  isHighlighted
                    ? 'border-amber-400 ring-4 ring-amber-400/20 bg-gradient-to-r from-amber-50/40 via-white to-white'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Highlight banner for new orders */}
                {isHighlighted && (
                  <div className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black tracking-wider uppercase px-3 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-bounce">
                    <Sparkles size={12} />
                    JUST PLACED!
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  {/* Top-left: Merchant Name + Order ID */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center shrink-0 font-bold">
                      <StoreIcon size={20} className="text-sky-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Merchant store pill */}
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1.5">
                          <StoreIcon size={12} className="text-sky-600" />
                          {merchantName}
                        </span>

                        {/* Order ID chip */}
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          #{shortId}
                          <button
                            onClick={(e) => handleCopyId(e, order._id)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                            title="Copy full Order ID"
                          >
                            {copiedId === order._id ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </span>

                        {/* Warehouse order tag if applicable */}
                        {order.isWarehouseOrder && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                            Warehouse Order
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <Clock size={12} />
                        <span>{formatTimeAgo(order.createdAt)}</span>
                        <span>•</span>
                        <span>{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top-right: Status Badge & Amount */}
                  <div className="flex items-center gap-3 self-start lg:self-auto">
                    {/* Status badge */}
                    <div
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${statusConfig.badgeBg}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusConfig.dotBg}`}></span>
                      <span>{statusConfig.label}</span>
                    </div>

                    {/* Total Amount */}
                    <div className="text-right">
                      <div className="text-base font-black text-slate-900">₹{totalAmount}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">
                        {order.paymentStatus || 'Payment Done'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body Details: Customer, Address, Items */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
                  {/* Column 1: Customer details */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer</span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span>{customerName}</span>
                    </div>
                    {customerPhone && (
                      <a
                        href={`tel:${customerPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sky-600 hover:underline flex items-center gap-1.5 font-semibold"
                      >
                        <Phone size={13} className="shrink-0" />
                        <span>{customerPhone}</span>
                      </a>
                    )}
                  </div>

                  {/* Column 2: Delivery Destination */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Address</span>
                    <div className="text-slate-700 flex items-start gap-1.5 line-clamp-2">
                      <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                      <span>{deliveryAddress}</span>
                    </div>
                  </div>

                  {/* Column 3: Rider & Items Summary */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Fulfillment ({itemsCount} items)
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.deliveryRiderDetails?.name || order.deliveryRiderId?.name ? (
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-semibold flex items-center gap-1">
                          <Truck size={12} />
                          Rider: {order.deliveryRiderDetails?.name || order.deliveryRiderId?.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                          Rider not assigned yet
                        </span>
                      )}

                      {order.otp && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-bold flex items-center gap-1">
                          <KeyRound size={11} /> OTP: {order.otp}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items preview strip */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-full">
                      {order.items.slice(0, 4).map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl shrink-0"
                        >
                          {it.image ? (
                            <img
                              src={it.image}
                              alt={it.name}
                              className="w-6 h-6 rounded-md object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              👕
                            </div>
                          )}
                          <div className="text-[11px] leading-tight">
                            <span className="font-semibold text-slate-800 truncate max-w-[120px] block">
                              {it.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Size: {it.size || 'Free'} • Qty: {it.quantity || 1}
                            </span>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 4 && (
                        <span className="text-[11px] font-bold text-slate-500 px-2">
                          +{order.items.length - 4} more
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 ml-auto"
                    >
                      <span>View Details</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ORDER DETAIL SLIDE-OVER MODAL ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    Order Details
                    <span className="text-xs font-bold text-slate-400">
                      #{String(selectedOrder._id).slice(-5).toUpperCase()}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-sm text-slate-700">
              {/* Status & Store Header Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="w-5 h-5 text-sky-600" />
                    <div>
                      <div className="font-bold text-slate-900 text-base">
                        {selectedOrder.merchantId?.shopName ||
                          selectedOrder.merchantDetails?.name ||
                          selectedOrder.warehouseId?.name ||
                          'Store Partner'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {selectedOrder.merchantId?.phoneNumber || selectedOrder.merchantDetails?.phone || 'No phone'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${
                        (ORDER_STATUS_CONFIG[selectedOrder.orderStatus] || {}).badgeBg || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${(ORDER_STATUS_CONFIG[selectedOrder.orderStatus] || {}).dotBg || 'bg-slate-400'}`} />
                      {(ORDER_STATUS_CONFIG[selectedOrder.orderStatus] || {}).label || selectedOrder.orderStatus}
                    </span>
                  </div>
                </div>

                {/* Pickup OTP banner if packed */}
                {selectedOrder.otp && (
                  <div className="bg-purple-100 border border-purple-200 rounded-xl p-3 flex items-center justify-between text-purple-900">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <KeyRound size={18} className="text-purple-600" />
                      <span>Pickup Verification OTP:</span>
                    </div>
                    <span className="font-mono font-black text-lg tracking-widest text-purple-700 bg-white px-3 py-1 rounded-lg border border-purple-200 shadow-sm">
                      {selectedOrder.otp}
                    </span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Package size={14} />
                  Ordered Items ({selectedOrder.items?.length || 0})
                </h4>

                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center gap-3">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 shrink-0">
                          👕
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate">{item.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Size: <span className="font-semibold text-slate-700">{item.size || 'Free'}</span> • Qty:{' '}
                          <span className="font-semibold text-slate-700">{item.quantity || 1}</span>
                        </div>
                      </div>
                      <div className="text-right font-black text-slate-900 text-sm">
                        ₹{(item.price || 0) * (item.quantity || 1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Billing Breakdown */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Payment Summary
                </h4>
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-slate-800">₹{selectedOrder.totalAmount || 0}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charge</span>
                  <span className="font-semibold text-slate-800">₹{selectedOrder.deliveryCharge || 0}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Payment Mode</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {selectedOrder.paymentMode || selectedOrder.paymentMethod || 'Online / Razorpay'}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Payable</span>
                  <span className="text-base text-emerald-600">
                    ₹{selectedOrder.finalBilling?.totalPayable ?? selectedOrder.totalAmount ?? 0}
                  </span>
                </div>
              </div>

              {/* Customer & Address Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-white">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User size={14} /> Customer Information
                  </h4>
                  <div className="font-bold text-slate-900">
                    {selectedOrder.userId?.name || selectedOrder.deliveryLocation?.name || 'Customer'}
                  </div>
                  {(selectedOrder.userId?.phoneNumber || selectedOrder.deliveryLocation?.phone) && (
                    <a
                      href={`tel:${selectedOrder.userId?.phoneNumber || selectedOrder.deliveryLocation?.phone}`}
                      className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Phone size={13} />
                      {selectedOrder.userId?.phoneNumber || selectedOrder.deliveryLocation?.phone}
                    </a>
                  )}
                  {selectedOrder.userId?.email && (
                    <div className="text-xs text-slate-500 truncate">{selectedOrder.userId.email}</div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-white">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MapPin size={14} /> Delivery Destination
                  </h4>
                  <div className="text-xs text-slate-700 leading-relaxed">
                    {selectedOrder.deliveryLocation?.addressLine1 ||
                      selectedOrder.deliveryLocation?.street ||
                      selectedOrder.deliveryLocation?.address ||
                      'No street specified'}
                    {selectedOrder.deliveryLocation?.landmark && (
                      <div className="text-slate-500 mt-1">
                        Near: {selectedOrder.deliveryLocation.landmark}
                      </div>
                    )}
                    {selectedOrder.deliveryLocation?.city && (
                      <div className="text-slate-500">
                        {selectedOrder.deliveryLocation.city}{' '}
                        {selectedOrder.deliveryLocation.pincode ? `- ${selectedOrder.deliveryLocation.pincode}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Rider Assignment */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-white">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Truck size={14} /> Delivery Rider Status
                </h4>
                {selectedOrder.deliveryRiderDetails?.name || selectedOrder.deliveryRiderId?.name ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">
                        {selectedOrder.deliveryRiderDetails?.name || selectedOrder.deliveryRiderId?.name}
                      </div>
                      <div className="text-xs text-sky-600 font-semibold mt-0.5">
                        {selectedOrder.deliveryRiderDetails?.phone || selectedOrder.deliveryRiderId?.phone}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                      Rider Status: {selectedOrder.deliveryRiderStatus || 'assigned'}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    No delivery rider assigned yet. Rider matching in progress.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                onClick={(e) => handleCopyId(e, selectedOrder._id)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
              >
                {copiedId === selectedOrder._id ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span>Copied Order ID</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Full Order ID</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
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

export default LiveOrders;
