// src/routes/AppRoutes.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import MerchantLayout from '../layouts/MerchantLayout';

import Merchants from '../pages/admin/Merchants';
import AdminDashboard from '../pages/admin/Dashboard';
import AddCategory from '../pages/admin/AddCategory';
import Category from '../pages/admin/Category';
import AddProducts from '../pages/admin/AddProducts';
import MerchantDashboard from '../pages/merchant/MerchantDashboard';
import AddProduct from '../pages/merchant/AddProduct';``
import NotFound from '../pages/NotFound';
import AddMerchants from '../pages/admin/AddMerchants';
// Placeholder components for missing admin pages
const Settings = () => <div>Settings Page</div>;


const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="category" element={<Category />} />
          <Route path="merchants" element={<Merchants />} />
          <Route path="settings" element={<Settings />} />
          <Route path="add-category" element={<AddCategory />} />
          <Route path="add-products" element={<AddProducts />} />
          <Route path="add-merchant" element={<AddMerchants />} />
        </Route>

        {/* Merchant Routes */}
        <Route path="/merchant" element={<MerchantLayout />}>
          <Route index element={<MerchantDashboard />} />
          <Route path="add-product" element={<AddProduct />} />
        </Route>

        {/* Catch All */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
