import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';

const AdminRegister = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-neutral-900 flex flex-col justify-center items-center p-4 selection:bg-rose-500 selection:text-white font-sans">
            <div className="w-full max-w-md">
                {/* Header Section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-500 shadow-xl shadow-rose-500/20 mb-6">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                        Registration Restricted
                    </h1>
                    <p className="text-neutral-400 text-sm">
                        FlashFits Administration Portal
                    </p>
                </div>

                {/* Info Card */}
                <div className="bg-neutral-800/50 backdrop-blur-xl border border-neutral-700/50 rounded-2xl p-8 shadow-2xl space-y-6">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                        <p className="text-sm text-amber-400 font-medium">
                            New administrator and sales representative accounts can only be created internally by a Super Admin from the portal dashboard.
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/admin/login')}
                        className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 focus:outline-none transition-all"
                    >
                        Go to Sign In
                    </button>

                    <div className="pt-6 border-t border-neutral-700/50">
                        <Link
                            to="/admin/login"
                            className="flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminRegister;
