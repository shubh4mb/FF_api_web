import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar';

const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen ml-56">
        {/* Top Navbar */}
        <header className="h-16 bg-white shadow flex items-center px-8 sticky top-0 z-10">
          <div className="flex-1 text-lg font-semibold text-slate-700">Admin Dashboard</div>
          <div className="flex items-center gap-4">
            {/* Example user avatar */}
            <span className="w-8 h-8 rounded-full bg-sky-400 flex items-center justify-center text-white font-bold">
              A
            </span>
            <span className="text-slate-600 font-medium">Admin</span>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-8">
          <div className="bg-white rounded-xl shadow p-8 min-h-[70vh]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;