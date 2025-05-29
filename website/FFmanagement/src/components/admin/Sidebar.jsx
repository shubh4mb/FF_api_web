import React from 'react';
import { NavLink } from 'react-router-dom';


function Sidebar() {
  return (
    <aside className="w-56 bg-slate-800 text-white h-screen fixed left-0 top-0 flex flex-col justify-between py-8 shadow-lg z-20">
      <div>
        {/* Branding */}
        <div className="items-center gap-2 px-8 mb-10">
          <span className="text-sky-400 text-3xl font-black">FlashFits</span>
          <span className="text-lg font-bold tracking-wide">Admin</span>
        </div>
        {/* Navigation */}
        <nav>
          <ul className="space-y-2 px-4">
            <li>
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-400 text-slate-800 font-semibold'
                      : 'hover:bg-sky-700 hover:text-sky-400'
                  }`
                }
              >
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/category"
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-400 text-slate-800 font-semibold'
                      : 'hover:bg-sky-700 hover:text-sky-400'
                  }`
                }
              >
                Category
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/merchants"
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-400 text-slate-800 font-semibold'
                      : 'hover:bg-sky-700 hover:text-sky-400'
                  }`
                }
              >
                Merchants
              </NavLink>
            </li>    
            <li>
              <NavLink
                to="/admin/add-products"
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-400 text-slate-800 font-semibold'
                      : 'hover:bg-sky-700 hover:text-sky-400'
                  }`
                }
              >
                Add Products
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/add-merchant"
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-400 text-slate-800 font-semibold'
                      : 'hover:bg-sky-700 hover:text-sky-400'
                  }`
                }
              >
                Add Merchant
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/settings"
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-400 text-slate-800 font-semibold'
                      : 'hover:bg-sky-700 hover:text-sky-400'
                  }`
                }
              >
                Settings
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
      {/* User/Profile section */}
      <div className="px-8">
        <div className="flex items-center gap-3 mt-8">
          <span className="w-9 h-9 rounded-full bg-sky-400 flex items-center justify-center text-white font-bold">
            A
          </span>
          <div>
            <div className="font-semibold text-sm">Admin User</div>
            <div className="text-xs text-sky-200">Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;