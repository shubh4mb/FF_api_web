// src/routes/AppRoutes.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import MerchantLayout from '../layouts/MerchantLayout';
import Merchants from '../pages/admin/Merchants';
import AdminDashboard from '../pages/admin/Dashboard';
import AddCategory from '../pages/admin/AddCategory';
import Category from '../pages/admin/Category';
import AddProducts from '../pages/admin/AddProducts';
import MerchantDashboard from '../pages/merchant/MerchantDashboard';
import AddProduct from '../pages/merchant/AddProduct';
import NotFound from '../pages/NotFound';
import AddMerchants from '../pages/admin/AddMerchants';
import Products from '../pages/admin/Products';
import Variants from '../pages/admin/Variants';
import EditMerchant from '../pages/admin/EditMerchant';
import Title_Banner from '../pages/admin/Title_Banner';
import MatchingProducts from '../pages/admin/MatchingProducts';
import CreateZone from '../pages/admin/CreateZone';
import BannersPage from '../pages/Banners/BannersPage';
import EditCategory from '../pages/admin/EditCategory';
import AdminLogin from '../pages/admin/AdminLogin';
import AdminRegister from '../pages/admin/AdminRegister';
import ProtectedAdminRoute from '../components/ProtectedAdminRoute';
import Settings from '../pages/admin/Settings';
import AttributeManagement from '../pages/admin/AttributeManagement';
import Hubs from '../pages/admin/Hubs';
import OffersManagement from '../pages/admin/OffersManagement';
import CollectionManagement from '../pages/admin/CollectionManagement';
import Zones from '../pages/admin/Zones';
import IncentiveManagement from '../pages/admin/IncentiveManagement';
import PayoutManagement from '../pages/admin/PayoutManagement';
import SupportTickets from '../pages/admin/SupportTickets';
import ZipCoverRequests from '../pages/admin/ZipCoverRequests';
import OrderCancellations from '../pages/admin/OrderCancellations';
import AuditLogs from '../pages/admin/AuditLogs';

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        {/* Admin Public Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/register" element={<AdminRegister />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={<ProtectedAdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="category" element={<Category />} />
            <Route path="merchants" element={<Merchants />} />
            <Route path="settings" element={<Settings />} />
            <Route path="add-category" element={<AddCategory />} />
            <Route path="edit-category/:categoryId" element={<EditCategory />} />
            <Route path="add-products" element={<AddProducts />} />
            <Route path="matching-products/:productId" element={<MatchingProducts />} />
            <Route path="add-merchant" element={<AddMerchants />} />
            <Route path="products" element={<Products />} />
            <Route path="variants/:productId" element={<Variants />} />
            <Route path="add-title-banner" element={<Title_Banner />} />
            <Route path="merchants/:merchantId" element={<EditMerchant />} />
            <Route path="zones" element={<Zones />} />
            <Route path="create-zone" element={<CreateZone />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="attributes" element={<AttributeManagement />} />
            <Route path="hubs" element={<Hubs />} />
            <Route path="offers" element={<OffersManagement />} />
            <Route path="collections" element={<CollectionManagement />} />
            <Route path="incentives" element={<IncentiveManagement />} />
            <Route path="payouts" element={<PayoutManagement />} />
            <Route path="support" element={<SupportTickets />} />
            <Route path="zip-covers" element={<ZipCoverRequests />} />
            <Route path="order-cancellations" element={<OrderCancellations />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>
        </Route>

        {/* Catch old admin routes and redirect appropriately (optional, since /admin captures everything under ProtectedAdminRoute) */}

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
