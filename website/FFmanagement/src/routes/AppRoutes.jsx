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
import AddBrand from '../pages/admin/AddBrand';
import Products from '../pages/admin/Products';
import Variants from '../pages/admin/Variants';
import EditMerchant from '../pages/admin/EditMerchant';
import Title_Banner from '../pages/admin/Title_Banner';
import MatchingProducts from '../pages/admin/MatchingProducts';
import CreateZone from '../pages/admin/CreateZone';
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
          <Route path="matching-products/:productId" element={<MatchingProducts />} />
          <Route path="add-merchant" element={<AddMerchants />} />
          <Route path="add-brand" element={<AddBrand />} />
          <Route path="products" element={<Products />} />
          <Route path="variants/:productId" element={<Variants />} />
          <Route path="add-title-banner" element={<Title_Banner />} />
          <Route path="merchants/:merchantId" element={<EditMerchant />} />
          <Route path="create-zone" element={<CreateZone />} />
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
