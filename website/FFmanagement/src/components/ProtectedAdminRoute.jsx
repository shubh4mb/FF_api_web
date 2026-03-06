import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedAdminRoute = () => {
    const token = localStorage.getItem('adminToken');
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');

    // Check if token exists and user is an admin
    if (!token || user.role !== 'superadmin') {
        return <Navigate to="/admin/login" replace />;
    }

    // Render the child routes (AdminLayout)
    return <Outlet />;
};

export default ProtectedAdminRoute;
