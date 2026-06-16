import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedAdminRoute = () => {
    const token = localStorage.getItem('adminToken');
    let user = {};
    try {
        const storedUser = localStorage.getItem('adminUser');
        if (storedUser && storedUser !== 'undefined') {
            user = JSON.parse(storedUser);
        }
    } catch (error) {
        console.error('Failed to parse adminUser from localStorage', error);
        localStorage.removeItem('adminUser');
    }

    // Check if token exists and user is an admin
    if (!token || user.role !== 'superadmin') {
        return <Navigate to="/admin/login" replace />;
    }

    // Render the child routes (AdminLayout)
    return <Outlet />;
};

export default ProtectedAdminRoute;
