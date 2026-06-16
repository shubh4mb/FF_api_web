import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  Store, 
  ShoppingBag, 
  Truck, 
  TrendingUp,
  AlertCircle,
  Wifi
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import toast from 'react-hot-toast';
import { getDashboardStats } from '../../api/dashboard';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrderValue: 0,
    activeMerchants: 0,
    onlineMerchants: 0,
    activeTnbOrders: 0,
    activeCourierOrders: 0
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      if (data?.stats) {
        setStats(data.stats);
      }
      if (data?.charts?.orderAnalytics) {
        setChartData(data.charts.orderAnalytics);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Custom Tooltip for Area Chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-100">
          <p className="font-semibold text-slate-800 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600 capitalize">{entry.name}:</span>
              <span className="font-medium text-slate-900">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Platform Overview</h1>
        <p className="text-slate-500 mt-1">Real-time metrics and analytics for FlashFits operations</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* Total Order Value */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <p className="text-emerald-50 font-medium text-sm uppercase tracking-wider">Gross Value</p>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
            </div>
            <h3 className="text-3xl font-bold">{formatCurrency(stats.totalOrderValue)}</h3>
            <p className="text-emerald-100 text-sm mt-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Lifetime value
            </p>
          </div>
        </div>

        {/* Active Merchants (Enrolled) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-500 font-medium text-sm uppercase tracking-wider">Enrolled Stores</p>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.activeMerchants}</h3>
          <p className="text-slate-400 text-sm mt-2">Verified partners</p>
        </div>

        {/* Online Merchants */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-500 font-medium text-sm uppercase tracking-wider">Online Stores</p>
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Wifi className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.onlineMerchants}</h3>
          <p className="text-slate-400 text-sm mt-2">Accepting orders now</p>
        </div>

        {/* Try & Buy Orders */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-500 font-medium text-sm uppercase tracking-wider">Active T&B</p>
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-rose-600" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.activeTnbOrders}</h3>
          <p className="text-slate-400 text-sm mt-2">Orders in progress</p>
        </div>

        {/* Courier Orders */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-500 font-medium text-sm uppercase tracking-wider">Courier</p>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.activeCourierOrders}</h3>
          <p className="text-slate-400 text-sm mt-2">Currently in transit</p>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        
        {/* Order Volume Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Order Volume</h3>
              <p className="text-sm text-slate-500">Total vs Returned (Last 30 Days)</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}/>
                  <Area 
                    type="monotone" 
                    dataKey="Orders" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorOrders)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Returns" 
                    stroke="#f43f5e" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorReturns)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                <p>No data available for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Return Rate Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Return Rate Analysis</h3>
              <p className="text-sm text-slate-500">Percentage of returns per day</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar 
                    dataKey="ReturnRate" 
                    name="Return Rate %" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                <p>No data available for this period</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;