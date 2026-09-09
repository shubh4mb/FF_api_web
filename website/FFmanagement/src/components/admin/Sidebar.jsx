import React from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

function Sidebar({ isOpen, onClose }) {
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

  // Navigation items definition
  const menuItems = [
    { to: '/admin', label: 'Dashboard', end: true, roles: ['superadmin'] },
    { to: '/admin/leads', label: 'Sales Leads', roles: ['superadmin', 'sales'] },
    { to: '/admin/category', label: 'Category', roles: ['superadmin'] },
    { to: '/admin/merchants', label: 'Merchants', roles: ['superadmin'] },
    { to: '/admin/products', label: 'Products', roles: ['superadmin'] },
    { to: '/admin/banners', label: 'Banners', roles: ['superadmin'] },
    { to: '/admin/attributes', label: 'Attributes', roles: ['superadmin'] },
    { to: '/admin/hubs', label: 'Hubs', roles: ['superadmin'] },
    { to: '/admin/zones', label: 'Zones', roles: ['superadmin'] },
    { to: '/admin/warehouses', label: 'Warehouses', roles: ['superadmin'] },
    { to: '/admin/warehouse-products', label: 'Warehouse Products', roles: ['superadmin'] },
    { to: '/admin/warehouse-orders', label: 'Warehouse Orders', roles: ['superadmin'] },
    { to: '/admin/offers', label: 'Offers', roles: ['superadmin'] },
    { to: '/admin/collections', label: 'Collections', roles: ['superadmin'] },
    { to: '/admin/incentives', label: 'Incentives', roles: ['superadmin'] },
    { to: '/admin/payouts', label: 'Payouts', roles: ['superadmin'] },
    { to: '/admin/support', label: 'Support', roles: ['superadmin'] },
    { to: '/admin/return-issues', label: 'Return Issues', roles: ['superadmin'] },
    { to: '/admin/settings', label: 'Settings', roles: ['superadmin'] },
    { to: '/admin/zip-covers', label: 'Zip Cover Requests', roles: ['superadmin'] },
    { to: '/admin/order-cancellations', label: 'Order Cancellations', roles: ['superadmin'] },
    { to: '/admin/unresponsive-riders', label: 'Unresponsive Riders', roles: ['superadmin'] },
    { to: '/admin/audit-logs', label: 'Audit Logs', roles: ['superadmin'] },
    { to: '/admin/notifications', label: 'Push Notifications', roles: ['superadmin'] },
  ];

  // Filter items by current user's role (defaults to superadmin if role is missing)
  const currentRole = adminUser.role || 'superadmin';
  const filteredItems = menuItems.filter(item => item.roles.includes(currentRole));

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          w-64 lg:w-56 bg-slate-800 text-white h-screen fixed left-0 top-0 flex flex-col py-8 shadow-lg z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Branding + Mobile close button */}
        <div className="px-6 lg:px-8 mb-10 shrink-0 flex items-start justify-between">
          <div>
            <span className="text-sky-400 text-3xl font-black block">FlashFits</span>
            <span className="text-lg font-bold tracking-wide">Admin</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors mt-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation - Scrollable middle section */}
        <nav className="flex-1 overflow-y-auto px-3 lg:px-4 custom-scrollbar">
          <ul className="space-y-1 pb-8">
            {filteredItems.map((item, idx) => (
              <li key={idx}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `block px-4 py-2.5 rounded-lg transition-colors text-sm ${isActive
                      ? 'bg-sky-400 text-slate-800 font-semibold'
                      : 'hover:bg-slate-700 hover:text-sky-400'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User/Profile section - Fixed at bottom */}
        <div className="px-6 lg:px-8 mt-4 shrink-0">
          <div className="flex items-center gap-3 pt-6 border-t border-slate-700">
            <span className="w-9 h-9 rounded-full bg-sky-400 flex items-center justify-center text-white font-bold shrink-0">
              {adminUser.name ? adminUser.name[0].toUpperCase() : 'A'}
            </span>
            <div className="overflow-hidden">
              <div className="font-semibold text-sm truncate">{adminUser.name || 'Admin User'}</div>
              <div className="text-xs text-sky-200 truncate">
                {adminUser.role === 'sales' ? 'Sales Rep' : 'Super Admin'}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;