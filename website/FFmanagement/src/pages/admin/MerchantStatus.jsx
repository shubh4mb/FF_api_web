import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getMerchantStatusOverview, 
  toggleMerchantOnlineAdmin, 
  bulkToggleMerchantOnlineAdmin 
} from '@/api/merchants';
import { useAdminOrderSocket } from '@/hooks/useAdminOrderSocket';
import { toast } from 'react-hot-toast';
import {
  Power,
  Search,
  RefreshCw,
  Store,
  CheckCircle2,
  XCircle,
  Smartphone,
  MapPin,
  Clock,
  Phone,
  Mail,
  ExternalLink,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  ArrowUpDown,
  Building2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  User,
  Truck,
  Flame,
  X,
  Package
} from 'lucide-react';

const ORDER_STATUS_CONFIG = {
  placed: {
    label: 'Placed (New)',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    dotBg: 'bg-amber-500 animate-pulse',
  },
  accepted: {
    label: 'Accepted',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    dotBg: 'bg-blue-500',
  },
  packed: {
    label: 'Packed',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    dotBg: 'bg-purple-500',
  },
  in_transit: {
    label: 'In Transit',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    dotBg: 'bg-sky-500',
  },
  try_phase: {
    label: 'Trying Fits',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotBg: 'bg-indigo-500 animate-pulse',
  },
  selection_made: {
    label: 'Selection Made',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
    dotBg: 'bg-teal-500',
  },
  return_in_progress: {
    label: 'Return in Transit',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200',
    dotBg: 'bg-orange-500',
  },
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const MerchantStatus = () => {
  const navigate = useNavigate();

  // State
  const [merchants, setMerchants] = useState([]);
  const [stats, setStats] = useState({
    totalMerchants: 0,
    onlineCount: 0,
    offlineCount: 0,
    socketConnectedCount: 0,
    totalActiveOrders: 0,
    merchantsWithOrdersCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Expanded rows in table view
  const [expandedMerchantIds, setExpandedMerchantIds] = useState(new Set());
  // Modal for viewing orders
  const [selectedMerchantForOrders, setSelectedMerchantForOrders] = useState(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'offline' | 'app_connected' | 'has_orders'
  const [selectedZone, setSelectedZone] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [selectedMerchantIds, setSelectedMerchantIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('online_first'); // 'online_first' | 'offline_first' | 'orders_first' | 'name_asc'

  // Fetch data
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      const res = await getMerchantStatusOverview();
      const data = res.data || res;
      const list = data.merchants || [];
      setMerchants(list);
      if (data.stats) {
        setStats(data.stats);
      } else {
        const onlineCount = list.filter(m => m.isOnline).length;
        const totalActiveOrders = list.reduce((acc, m) => acc + (m.activeOrdersCount || 0), 0);
        const merchantsWithOrdersCount = list.filter(m => (m.activeOrdersCount || 0) > 0).length;
        setStats({
          totalMerchants: list.length,
          onlineCount,
          offlineCount: list.length - onlineCount,
          socketConnectedCount: list.filter(m => m.isSocketConnected).length,
          totalActiveOrders,
          merchantsWithOrdersCount,
        });
      }
    } catch (err) {
      console.error('Error fetching merchant status overview:', err);
      toast.error(err.response?.data?.message || 'Failed to load merchant status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time socket handlers
  const handleSocketMerchantStatus = useCallback((payload) => {
    if (!payload) return;
    if (payload.merchantId) {
      setMerchants(prev => prev.map(m => {
        if (m._id === payload.merchantId) {
          return { ...m, isOnline: payload.isOnline };
        }
        return m;
      }));

      setStats(prev => {
        const delta = payload.isOnline ? 1 : -1;
        return {
          ...prev,
          onlineCount: Math.max(0, Math.min(prev.totalMerchants, prev.onlineCount + delta)),
          offlineCount: Math.max(0, Math.min(prev.totalMerchants, prev.offlineCount - delta)),
        };
      });

      toast(
        (t) => (
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${payload.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>
              <strong>{payload.shopName || 'Merchant'}</strong> is now{' '}
              <strong className={payload.isOnline ? 'text-emerald-600' : 'text-slate-600'}>
                {payload.isOnline ? 'ONLINE' : 'OFFLINE'}
              </strong>
            </span>
          </div>
        ),
        { duration: 3500 }
      );
    } else if (payload.merchantIds) {
      fetchData(true);
    }
  }, [fetchData]);

  // When a new order or order update comes in, silently re-fetch to keep active orders accurate
  const handleSocketOrderEvent = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const { isConnected } = useAdminOrderSocket({
    onMerchantStatusChanged: handleSocketMerchantStatus,
    onNewOrder: handleSocketOrderEvent,
    onOrderUpdate: handleSocketOrderEvent,
  });

  // Extract unique zones
  const zonesList = useMemo(() => {
    const set = new Set();
    merchants.forEach(m => {
      if (m.zoneName) set.add(m.zoneName);
    });
    return Array.from(set).sort();
  }, [merchants]);

  // Filter & sort
  const filteredMerchants = useMemo(() => {
    return merchants
      .filter(m => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = m.shopName?.toLowerCase().includes(q);
          const matchPhone = m.phoneNumber?.toLowerCase().includes(q);
          const matchEmail = m.email?.toLowerCase().includes(q);
          const matchZone = m.zoneName?.toLowerCase().includes(q);
          const matchCity = m.address?.city?.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchEmail && !matchZone && !matchCity) {
            return false;
          }
        }

        if (statusFilter === 'online' && !m.isOnline) return false;
        if (statusFilter === 'offline' && m.isOnline) return false;
        if (statusFilter === 'app_connected' && !m.isSocketConnected) return false;
        if (statusFilter === 'has_orders' && (!m.activeOrdersCount || m.activeOrdersCount === 0)) return false;

        if (selectedZone !== 'all' && m.zoneName !== selectedZone) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'orders_first') {
          const diff = (b.activeOrdersCount || 0) - (a.activeOrdersCount || 0);
          if (diff !== 0) return diff;
          return (a.shopName || '').localeCompare(b.shopName || '');
        }
        if (sortBy === 'online_first') {
          if (a.isOnline === b.isOnline) {
            const orderDiff = (b.activeOrdersCount || 0) - (a.activeOrdersCount || 0);
            if (orderDiff !== 0) return orderDiff;
            return (a.shopName || '').localeCompare(b.shopName || '');
          }
          return a.isOnline ? -1 : 1;
        }
        if (sortBy === 'offline_first') {
          if (a.isOnline === b.isOnline) return (a.shopName || '').localeCompare(b.shopName || '');
          return a.isOnline ? 1 : -1;
        }
        if (sortBy === 'name_asc') {
          return (a.shopName || '').localeCompare(b.shopName || '');
        }
        return 0;
      });
  }, [merchants, searchQuery, statusFilter, selectedZone, sortBy]);

  // Single toggle handler
  const handleToggleOnline = async (merchant, targetOnlineState) => {
    const mId = merchant._id;
    const willBeOnline = targetOnlineState !== undefined ? targetOnlineState : !merchant.isOnline;
    
    setUpdatingId(mId);

    // Optimistic UI update
    setMerchants(prev => prev.map(m => m._id === mId ? { ...m, isOnline: willBeOnline } : m));
    setStats(prev => ({
      ...prev,
      onlineCount: willBeOnline ? prev.onlineCount + 1 : Math.max(0, prev.onlineCount - 1),
      offlineCount: willBeOnline ? Math.max(0, prev.offlineCount - 1) : prev.offlineCount + 1,
    }));

    try {
      const res = await toggleMerchantOnlineAdmin(mId, willBeOnline);
      toast.success(res.message || `${merchant.shopName} is now ${willBeOnline ? 'ONLINE' : 'OFFLINE'}`);
    } catch (err) {
      console.error('Failed to toggle merchant online status:', err);
      toast.error(err.response?.data?.message || 'Failed to update merchant status');
      setMerchants(prev => prev.map(m => m._id === mId ? { ...m, isOnline: !willBeOnline } : m));
      setStats(prev => ({
        ...prev,
        onlineCount: willBeOnline ? Math.max(0, prev.onlineCount - 1) : prev.onlineCount + 1,
        offlineCount: willBeOnline ? prev.offlineCount + 1 : Math.max(0, prev.offlineCount - 1),
      }));
    } finally {
      setUpdatingId(null);
    }
  };

  // Bulk toggle handler
  const handleBulkToggle = async (targetOnline) => {
    const ids = Array.from(selectedMerchantIds);
    if (ids.length === 0) return;

    const actionText = targetOnline ? 'ONLINE' : 'OFFLINE';
    if (!window.confirm(`Are you sure you want to turn ${ids.length} selected merchants ${actionText}?`)) {
      return;
    }

    setBulkLoading(true);
    try {
      const res = await bulkToggleMerchantOnlineAdmin(ids, targetOnline);
      toast.success(res.message || `Turned ${ids.length} merchants ${actionText}`);
      setSelectedMerchantIds(new Set());
      await fetchData(true);
    } catch (err) {
      console.error('Failed bulk toggle:', err);
      toast.error(err.response?.data?.message || 'Failed to bulk toggle merchants');
    } finally {
      setBulkLoading(false);
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedMerchantIds.size === filteredMerchants.length) {
      setSelectedMerchantIds(new Set());
    } else {
      setSelectedMerchantIds(new Set(filteredMerchants.map(m => m._id)));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedMerchantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandMerchant = (id) => {
    setExpandedMerchantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = filteredMerchants.length > 0 && selectedMerchantIds.size === filteredMerchants.length;

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                Merchant Online Status
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isConnected 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {isConnected ? 'Live Sync' : 'Connecting'}
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Control store operating availability and monitor current active orders in real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => navigate('/admin/live-orders')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-500 transition-all shadow-sm active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Live Orders Feed</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Merchants */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Merchants</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{stats.totalMerchants}</span>
            <span className="text-xs text-slate-500">stores</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Registered fleet partners
          </div>
        </div>

        {/* Online Stores */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Stores Online
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">{stats.onlineCount}</span>
            <span className="text-xs font-semibold text-emerald-600">
              {stats.totalMerchants ? `${Math.round((stats.onlineCount / stats.totalMerchants) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-700/80">
            Accepting customer orders
          </div>
        </div>

        {/* Offline Stores */}
        <div className="bg-gradient-to-br from-slate-50 to-amber-50/30 border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Stores Offline</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-700">{stats.offlineCount}</span>
            <span className="text-xs font-semibold text-slate-500">
              {stats.totalMerchants ? `${Math.round((stats.offlineCount / stats.totalMerchants) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Paused / closed
          </div>
        </div>

        {/* Current Active Orders */}
        <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 border border-amber-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              Current Orders
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-800">{stats.totalActiveOrders || 0}</span>
            <span className="text-xs font-semibold text-amber-700">active in-flight</span>
          </div>
          <div className="mt-2 text-xs text-amber-700/80">
            Across {stats.merchantsWithOrdersCount || 0} stores
          </div>
        </div>

        {/* App Connected */}
        <div className="bg-gradient-to-br from-sky-50/70 to-indigo-50/40 border border-sky-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
              App Connected
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-sky-700">{stats.socketConnectedCount}</span>
            <span className="text-xs text-sky-600 font-semibold">live sockets</span>
          </div>
          <div className="mt-2 text-xs text-sky-700/80">
            Active merchant mobile apps
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        {/* Row 1: Search & Filter Tabs */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by shop name, phone, email, zone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold text-slate-600">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              All ({merchants.length})
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'online'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'hover:text-emerald-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'online' ? 'bg-white' : 'bg-emerald-500'}`} />
              Online ({stats.onlineCount})
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'offline'
                  ? 'bg-slate-800 text-white shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              Offline ({stats.offlineCount})
            </button>
            <button
              onClick={() => setStatusFilter('has_orders')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'has_orders'
                  ? 'bg-amber-600 text-white shadow-sm font-bold'
                  : 'hover:text-amber-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Active Orders ({stats.merchantsWithOrdersCount || 0})
            </button>
            <button
              onClick={() => setStatusFilter('app_connected')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'app_connected'
                  ? 'bg-sky-600 text-white shadow-sm font-bold'
                  : 'hover:text-sky-700'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              App Live ({stats.socketConnectedCount})
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Filters (Zone, Sort, View Mode) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Zone Filter */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Zone:</span>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Zones ({zonesList.length})</option>
                {zonesList.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="orders_first">Active Orders First</option>
                <option value="online_first">Online First</option>
                <option value="offline_first">Offline First</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* View toggle (Table vs Cards) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'table' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'cards' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid cards view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selectedMerchantIds.size > 0 && (
        <div className="sticky top-20 z-30 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-sm">
              {selectedMerchantIds.size}
            </div>
            <div>
              <p className="text-sm font-bold">
                {selectedMerchantIds.size} {selectedMerchantIds.size === 1 ? 'merchant' : 'merchants'} selected
              </p>
              <p className="text-xs text-slate-400">
                Apply network operation to all selected partners
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => handleBulkToggle(true)}
              disabled={bulkLoading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Turn Online</span>
            </button>

            <button
              onClick={() => handleBulkToggle(false)}
              disabled={bulkLoading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Turn Offline</span>
            </button>

            <button
              onClick={() => setSelectedMerchantIds(new Set())}
              className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Merchant Content View ── */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">Loading merchant network & active orders...</p>
          <p className="text-xs text-slate-400 mt-1">Syncing live database flags, active orders, and socket telemetry</p>
        </div>
      ) : filteredMerchants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Merchants Found</h3>
          <p className="text-sm text-slate-500 mt-1">
            {searchQuery || statusFilter !== 'all' || selectedZone !== 'all'
              ? 'No merchants matched your current filters. Try resetting search or status filters.'
              : 'No merchants are registered in the system yet.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || selectedZone !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSelectedZone('all');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3.5 w-12 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="p-1 hover:text-slate-800 transition"
                      title={isAllSelected ? "Deselect all" : "Select all"}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">Merchant / Store</th>
                  <th className="px-4 py-3.5">Zone & Location</th>
                  <th className="px-4 py-3.5 text-center">App Connection</th>
                  <th className="px-4 py-3.5 text-center">Store Status</th>
                  <th className="px-6 py-3.5 text-center">Online Toggle</th>
                  <th className="px-4 py-3.5 text-center">Current Orders</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMerchants.map((merchant) => {
                  const isOnline = !!merchant.isOnline;
                  const isSelected = selectedMerchantIds.has(merchant._id);
                  const isUpdating = updatingId === merchant._id;
                  const logoUrl = merchant.logo?.url;
                  const activeOrders = merchant.currentOrders || [];
                  const activeCount = merchant.activeOrdersCount || activeOrders.length;
                  const isExpanded = expandedMerchantIds.has(merchant._id);

                  return (
                    <React.Fragment key={merchant._id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-emerald-50/30' : ''
                        } ${isExpanded ? 'bg-slate-50/50' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleSelectOne(merchant._id)}
                            className="p-1 hover:text-slate-800 transition"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>

                        {/* Store Details */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={merchant.shopName}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-black text-sm flex items-center justify-center shadow-xs">
                                {merchant.shopName ? merchant.shopName[0].toUpperCase() : 'M'}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                  {merchant.shopName}
                                </span>
                                {merchant.isVerified && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                                    Verified
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                {merchant.phoneNumber && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {merchant.phoneNumber}
                                  </span>
                                )}
                                {merchant.email && (
                                  <span className="hidden sm:flex items-center gap-1 text-slate-400 truncate max-w-[160px]">
                                    <Mail className="w-3 h-3" />
                                    {merchant.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Zone & Location */}
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <MapPin className="w-3 h-3 text-indigo-500" />
                              {merchant.zoneName || 'No Zone'}
                            </span>
                            <p className="text-xs text-slate-400 truncate max-w-[180px]">
                              {merchant.address?.city || merchant.address?.street || 'Address not set'}
                            </p>
                          </div>
                        </td>

                        {/* App Connection (Socket) */}
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            {merchant.isSocketConnected ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                                App Live
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                Disconnected
                              </span>
                            )}
                            {merchant.lastSeenAt && !merchant.isSocketConnected && (
                              <span className="text-[10px] text-slate-400 mt-1">
                                Seen {new Date(merchant.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Store Status Pill */}
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase transition-all shadow-xs ${
                              isOnline
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                              }`}
                            />
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </td>

                        {/* Online Toggle Switch Control */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleToggleOnline(merchant)}
                              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                                isOnline ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'
                              }`}
                              aria-label={`Toggle online status for ${merchant.shopName}`}
                              title={isOnline ? 'Click to turn store OFFLINE' : 'Click to turn store ONLINE'}
                            >
                              <span className="sr-only">Toggle store status</span>
                              <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                  isOnline ? 'translate-x-7 text-emerald-600' : 'translate-x-0 text-slate-400'
                                }`}
                              >
                                {isUpdating ? (
                                  <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                                ) : isOnline ? (
                                  <Power className="w-3 h-3" />
                                ) : (
                                  <Power className="w-3 h-3" />
                                )}
                              </span>
                            </button>
                          </div>
                        </td>

                        {/* Current Orders Column */}
                        <td className="px-4 py-4 text-center">
                          {activeCount > 0 ? (
                            <button
                              onClick={() => toggleExpandMerchant(merchant._id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 transition-colors shadow-xs active:scale-95 group"
                              title="Click to view current orders"
                            >
                              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-bounce" />
                              <span>{activeCount} {activeCount === 1 ? 'Active Order' : 'Active Orders'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-amber-700" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-amber-700" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 bg-slate-50">
                              0 orders
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {activeCount > 0 && (
                              <button
                                onClick={() => setSelectedMerchantForOrders(merchant)}
                                className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition"
                                title="Open Orders Modal"
                              >
                                <ShoppingBag className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/admin/merchants/${merchant._id}`)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                              title="Edit Merchant"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── EXPANDABLE CURRENT ORDERS ROW ── */}
                      {isExpanded && activeCount > 0 && (
                        <tr className="bg-amber-50/30 border-b border-amber-100">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                                <div className="flex items-center gap-2">
                                  <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                                  <span className="font-bold text-slate-900 text-sm">
                                    Current Active Orders for {merchant.shopName}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                    {activeCount} in progress
                                  </span>
                                </div>
                                <button
                                  onClick={() => navigate(`/admin/live-orders?search=${merchant.shopName}`)}
                                  className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                                >
                                  View all in Live Orders Feed &rarr;
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {activeOrders.map((order) => {
                                  const statusCfg = ORDER_STATUS_CONFIG[order.orderStatus] || {
                                    label: order.orderStatus,
                                    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
                                    dotBg: 'bg-slate-400',
                                  };

                                  return (
                                    <div
                                      key={order._id}
                                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-amber-300 transition-colors"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono font-bold text-xs text-slate-900">
                                          {order.orderCode}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.badgeBg}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotBg}`} />
                                          {statusCfg.label}
                                        </span>
                                      </div>

                                      <div className="mt-2.5 flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-900 text-sm">
                                          ₹{order.totalAmount || 0}
                                        </span>
                                        <span className="text-slate-500 font-medium">
                                          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                                        </span>
                                      </div>

                                      <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-1 text-xs text-slate-500">
                                        <div className="flex items-center gap-1 truncate">
                                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                                          <span className="truncate">{order.customerName}</span>
                                          {order.customerPhone && (
                                            <span className="text-slate-400">({order.customerPhone})</span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1 truncate">
                                          <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                                          <span className="truncate">
                                            {order.riderName ? `Rider: ${order.riderName}` : 'Rider: Assigning...'}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                                          <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTimeAgo(order.createdAt)}
                                          </span>
                                          <button
                                            onClick={() => navigate(`/admin/live-orders?search=${order._id}`)}
                                            className="text-blue-600 hover:underline font-semibold"
                                          >
                                            Track Order &rarr;
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID CARDS VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMerchants.map((merchant) => {
            const isOnline = !!merchant.isOnline;
            const isSelected = selectedMerchantIds.has(merchant._id);
            const isUpdating = updatingId === merchant._id;
            const logoUrl = merchant.logo?.url;
            const activeOrders = merchant.currentOrders || [];
            const activeCount = merchant.activeOrdersCount || activeOrders.length;

            return (
              <div
                key={merchant._id}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                  isOnline ? 'border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20' : 'border-slate-200'
                } ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={merchant.shopName}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-black text-base flex items-center justify-center shadow-xs">
                          {merchant.shopName ? merchant.shopName[0].toUpperCase() : 'M'}
                        </div>
                      )}

                      <div>
                        <h3 className="font-bold text-slate-900 text-base truncate max-w-[180px]">
                          {merchant.shopName}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {merchant.phoneNumber || 'No phone'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectOne(merchant._id)}
                      className="p-1 hover:text-slate-800 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <MapPin className="w-3 h-3 text-indigo-500" />
                      {merchant.zoneName || 'No Zone'}
                    </span>

                    {merchant.isSocketConnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                        App Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        App Idle
                      </span>
                    )}

                    {merchant.fulfillmentType && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                        {merchant.fulfillmentType}
                      </span>
                    )}
                  </div>

                  {/* Current Active Orders Strip */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                        Current Orders:
                      </span>
                      {activeCount > 0 ? (
                        <button
                          onClick={() => setSelectedMerchantForOrders(merchant)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 transition"
                        >
                          <Flame className="w-3 h-3 text-orange-500 fill-orange-500 animate-bounce" />
                          <span>{activeCount} in progress</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">None active</span>
                      )}
                    </div>

                    {/* Quick Preview Chips if orders exist */}
                    {activeCount > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {activeOrders.slice(0, 2).map((o) => {
                          const statusCfg = ORDER_STATUS_CONFIG[o.orderStatus] || {
                            label: o.orderStatus,
                            badgeBg: 'bg-slate-100 text-slate-700',
                          };
                          return (
                            <div
                              key={o._id}
                              onClick={() => setSelectedMerchantForOrders(merchant)}
                              className="cursor-pointer flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs transition"
                            >
                              <span className="font-mono font-semibold text-slate-800">{o.orderCode}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusCfg.badgeBg}`}>
                                {statusCfg.label}
                              </span>
                              <span className="font-bold text-slate-900">₹{o.totalAmount}</span>
                            </div>
                          );
                        })}
                        {activeCount > 2 && (
                          <button
                            onClick={() => setSelectedMerchantForOrders(merchant)}
                            className="text-[11px] font-bold text-blue-600 hover:underline block text-center w-full pt-1"
                          >
                            + {activeCount - 2} more orders...
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Status & Toggle */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                        isOnline
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                        }`}
                      />
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>

                  {/* Switch button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleToggleOnline(merchant)}
                      className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                        isOnline ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                      title={isOnline ? 'Turn OFFLINE' : 'Turn ONLINE'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                          isOnline ? 'translate-x-7 text-emerald-600' : 'translate-x-0 text-slate-400'
                        }`}
                      >
                        {isUpdating ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                        ) : (
                          <Power className="w-3 h-3" />
                        )}
                      </span>
                    </button>

                    <button
                      onClick={() => navigate(`/admin/merchants/${merchant._id}`)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      title="Edit Merchant"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: VIEW ALL CURRENT ORDERS FOR SELECTED MERCHANT ── */}
      {selectedMerchantForOrders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Current Orders — {selectedMerchantForOrders.shopName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedMerchantForOrders.currentOrders?.length || 0} active in-flight orders
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedMerchantForOrders(null)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
              {(selectedMerchantForOrders.currentOrders?.length || 0) === 0 ? (
                <div className="text-center py-10">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No active orders right now</p>
                  <p className="text-xs text-slate-400">All orders for this merchant have completed or cancelled.</p>
                </div>
              ) : (
                selectedMerchantForOrders.currentOrders.map((order) => {
                  const statusCfg = ORDER_STATUS_CONFIG[order.orderStatus] || {
                    label: order.orderStatus,
                    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
                    dotBg: 'bg-slate-400',
                  };

                  return (
                    <div
                      key={order._id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-amber-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {order.orderCode}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusCfg.badgeBg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotBg}`} />
                            {statusCfg.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {order.customerName}
                          </span>
                          {order.customerPhone && (
                            <span className="text-slate-400">({order.customerPhone})</span>
                          )}
                          <span className="text-slate-300">&bull;</span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTimeAgo(order.createdAt)}
                          </span>
                        </div>

                        {order.riderName && (
                          <div className="flex items-center gap-1 text-xs text-slate-600 pt-1">
                            <Truck className="w-3.5 h-3.5 text-sky-500" />
                            <span>Rider: <strong>{order.riderName}</strong></span>
                            {order.riderPhone && <span className="text-slate-400">({order.riderPhone})</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                        <div className="text-right">
                          <span className="font-black text-slate-900 text-base">₹{order.totalAmount}</span>
                          <span className="block text-[11px] text-slate-400">{order.itemCount} items</span>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedMerchantForOrders(null);
                            navigate(`/admin/live-orders?search=${order._id}`);
                          }}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-xs active:scale-95"
                        >
                          Track in Live Orders &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Clicking "Track in Live Orders" takes you to the full monitor
              </span>
              <button
                onClick={() => setSelectedMerchantForOrders(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
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

export default MerchantStatus;
