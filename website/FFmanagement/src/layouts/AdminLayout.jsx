import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';
import { LogOut, Menu } from 'lucide-react';

const AdminLayout = () => {
  const navigate = useNavigate();
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-rose-500 selection:text-white">
      {/* Sidebar - controlled open/close on mobile */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main content area — full width on mobile, offset on desktop */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-56 transition-all duration-300">
        {/* Top Navbar */}
        <header className="h-14 lg:h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center px-4 lg:px-8 sticky top-0 z-20 gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div className="flex-1 text-lg lg:text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent truncate">
            Admin Dashboard
          </div>

          <div className="flex items-center gap-2 lg:gap-6">
            {/* User chip — hide name on very small screens */}
            <div className="hidden sm:flex items-center gap-3 bg-slate-100 py-1.5 px-3 rounded-full border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {adminUser.name ? adminUser.name[0].toUpperCase() : 'A'}
              </div>
              <span className="text-slate-700 text-sm font-semibold pr-1">
                {adminUser.name || 'Admin'}
              </span>
            </div>

            {/* Mobile-only avatar (no name) */}
            <div className="sm:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {adminUser.name ? adminUser.name[0].toUpperCase() : 'A'}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 py-2 px-3 lg:px-4 rounded-xl text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-all group"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-3 sm:p-5 lg:p-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-10 min-h-[calc(100vh-160px)]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;