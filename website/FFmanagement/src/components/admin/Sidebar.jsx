import React from 'react';
import { NavLink } from 'react-router-dom';


function Sidebar() {
  return (
    <aside className="w-56 bg-slate-800 text-white h-screen fixed left-0 top-0 flex flex-col py-8 shadow-lg z-20">
      {/* Branding - Fixed at top */}
      <div className="px-8 mb-10 shrink-0">
        <span className="text-sky-400 text-3xl font-black block">FlashFits</span>
        <span className="text-lg font-bold tracking-wide">Admin</span>
      </div>

      {/* Navigation - Scrollable middle section */}
      <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar">
        <ul className="space-y-2 pb-8">
          <li>
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
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
                `block px-4 py-2 rounded-lg transition-colors ${isActive
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
                `block px-4 py-2 rounded-lg transition-colors ${isActive
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
                `block px-4 py-2 rounded-lg transition-colors ${isActive
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
              to="/admin/products"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Products
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/add-merchant"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
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
              to="/admin/add-brand"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Add Brand
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/banners"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Banners
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/attributes"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Attributes
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/hubs"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Hubs
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/zones"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Zones
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/offers"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Offers
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/collections"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Collections
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/incentives"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Incentives
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/payouts"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Payouts
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/support"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Support
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Settings
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/zip-covers"
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${isActive
                  ? 'bg-sky-400 text-slate-800 font-semibold'
                  : 'hover:bg-sky-700 hover:text-sky-400'
                }`
              }
            >
              Zip Cover Requests
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* User/Profile section - Fixed at bottom */}
      <div className="px-8 mt-4 shrink-0">
        <div className="flex items-center gap-3 pt-6 border-t border-slate-700">
          <span className="w-9 h-9 rounded-full bg-sky-400 flex items-center justify-center text-white font-bold shrink-0">
            A
          </span>
          <div className="overflow-hidden">
            <div className="font-semibold text-sm truncate">Admin User</div>
            <div className="text-xs text-sky-200 truncate">Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;