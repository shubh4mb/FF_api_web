import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { API_URL, clearAdminAuthSession } from '../utils/axios.config';
import { Loader2 } from 'lucide-react';

const ProtectedAdminRoute = () => {
    const [token, setToken] = useState(() => localStorage.getItem('adminToken'));
    const [checking, setChecking] = useState(() => {
        const hasToken = !!localStorage.getItem('adminToken');
        const hasRefreshToken = !!localStorage.getItem('adminRefreshToken');
        return !hasToken && hasRefreshToken;
    });

    useEffect(() => {
        let isMounted = true;
        const attemptSilentRefresh = async () => {
            const storedRefreshToken = localStorage.getItem('adminRefreshToken');
            if (!storedRefreshToken) {
                if (isMounted) setChecking(false);
                return;
            }

            try {
                const res = await axios.post(
                    `${API_URL}auth/admin/refresh`,
                    {
                        adminRefreshToken: storedRefreshToken,
                        refreshToken: storedRefreshToken,
                    },
                    {
                        withCredentials: true,
                        headers: {
                            'ngrok-skip-browser-warning': 'true',
                        },
                    }
                );

                const payload = res.data?.data || res.data;
                const newAccessToken = payload?.token;
                const newRefreshToken = payload?.adminRefreshToken || payload?.refreshToken;

                if (newAccessToken && isMounted) {
                    localStorage.setItem('adminToken', newAccessToken);
                    if (newRefreshToken) {
                        localStorage.setItem('adminRefreshToken', newRefreshToken);
                    }
                    setToken(newAccessToken);
                } else if (isMounted) {
                    clearAdminAuthSession();
                }
            } catch (err) {
                if (isMounted) {
                    clearAdminAuthSession();
                }
            } finally {
                if (isMounted) {
                    setChecking(false);
                }
            }
        };

        if (checking) {
            attemptSilentRefresh();
        }

        return () => {
            isMounted = false;
        };
    }, [checking]);

    if (checking) {
        return (
            <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500 mb-3" />
                <p className="text-sm text-neutral-400">Verifying session...</p>
            </div>
        );
    }

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

    // Check if token exists and user has authorized role
    if (!token || (user.role !== 'superadmin' && user.role !== 'sales')) {
        return <Navigate to="/admin/login" replace />;
    }

    // Render the child routes (AdminLayout)
    return <Outlet />;
};

export default ProtectedAdminRoute;
