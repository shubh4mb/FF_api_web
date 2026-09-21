import { useState, useEffect } from "react";
import { getAppConfig, updateAppConfig } from "../../api/appConfig";
import { Save, Loader2, AlertCircle, Power, CheckCircle2, ShieldAlert } from "lucide-react";
import { Navigate } from "react-router-dom";

const Settings = () => {
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
    if (adminUser.role === 'sales') {
        return <Navigate to="/admin/leads" replace />;
    }

    const [config, setConfig] = useState({
        isOrderPlacementEnabled: false,
        maintenanceTitle: "Maintenance in Progress",
        maintenanceMessage: "We are currently gearing up for launch! Live ordering is temporarily paused. Please check back soon.",
        deliveryPerKmRate: 12,
        returnPerKmRate: 7,
        waitingCharge: 10,
        deliveryRadius: 5,
        tryAndBuyRadius: 7,
        merchantRegistrationFee: 1000,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAppConfig();
            if (data?.config) {
                setConfig({
                    isOrderPlacementEnabled: data.config.isOrderPlacementEnabled ?? false,
                    maintenanceTitle: data.config.maintenanceTitle || "Maintenance in Progress",
                    maintenanceMessage: data.config.maintenanceMessage || "We are currently gearing up for launch! Live ordering is temporarily paused. Please check back soon.",
                    deliveryPerKmRate: data.config.deliveryPerKmRate ?? 12,
                    returnPerKmRate: data.config.returnPerKmRate ?? 7,
                    waitingCharge: data.config.waitingCharge ?? 10,
                    deliveryRadius: data.config.deliveryRadius ?? 5,
                    tryAndBuyRadius: data.config.tryAndBuyRadius ?? 7,
                    merchantRegistrationFee: data.config.merchantRegistrationFee ?? 1000,
                });
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load application configuration.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : (type === "number" ? Number(value) : value),
        }));
    };

    const handleToggleLiveOrder = () => {
        setConfig((prev) => ({
            ...prev,
            isOrderPlacementEnabled: !prev.isOrderPlacementEnabled,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError(null);
            setSuccessMsg("");

            await updateAppConfig(config);

            setSuccessMsg("Configuration updated successfully!");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
            console.error(err);
            setError("Failed to update configuration.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
                    <p className="text-gray-500 mt-1">Configure global platform charges, delivery rates, and live ordering status</p>
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {saving ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save Changes
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 border border-red-100">
                    <AlertCircle size={20} className="shrink-0 text-red-600" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {successMsg && (
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl flex items-center gap-3 border border-emerald-100">
                    <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
                    <p className="text-sm font-medium">{successMsg}</p>
                </div>
            )}

            {/* Section 1: Live Ordering & Maintenance Mode */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${config.isOrderPlacementEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            <Power size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Live Ordering & Launch Control</h2>
                            <p className="text-sm text-gray-500">Enable or pause customer order placement across the mobile apps</p>
                        </div>
                    </div>
                    <div>
                        {config.isOrderPlacementEnabled ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                LIVE • ACCEPTING ORDERS
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                MAINTENANCE MODE ACTIVE
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Toggle row */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="space-y-0.5 max-w-xl">
                            <label className="text-sm font-bold text-gray-900 cursor-pointer" onClick={handleToggleLiveOrder}>
                                Allow Customer Order Placement
                            </label>
                            <p className="text-xs text-gray-500">
                                When <strong>ON (True)</strong>, customers can place Try & Buy, Pan-India Courier, and Warehouse orders.
                                When <strong>OFF (False)</strong>, all checkout actions are safely blocked and the maintenance notice below is displayed.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={config.isOrderPlacementEnabled}
                            onClick={handleToggleLiveOrder}
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                config.isOrderPlacementEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    config.isOrderPlacementEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Maintenance notice fields */}
                    {!config.isOrderPlacementEnabled && (
                        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/60 space-y-4">
                            <div className="flex items-center gap-2 text-amber-900 text-sm font-semibold">
                                <ShieldAlert size={18} className="text-amber-600" />
                                Customer Maintenance Notice Preview
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-amber-900 block mb-1">
                                        Notice Title
                                    </label>
                                    <input
                                        type="text"
                                        name="maintenanceTitle"
                                        value={config.maintenanceTitle}
                                        onChange={handleChange}
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                                        placeholder="e.g. Maintenance in Progress"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-amber-900 block mb-1">
                                        Notice Message (Displayed in customer cart & checkout)
                                    </label>
                                    <textarea
                                        rows={2}
                                        name="maintenanceMessage"
                                        value={config.maintenanceMessage}
                                        onChange={handleChange}
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                                        placeholder="e.g. We are gearing up for launch! Live ordering is temporarily paused."
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Section 2: Delivery Configuration */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Delivery Configuration</h2>
                    <p className="text-sm text-gray-500">Set the per-kilometer charges for rider payouts and customer fees.</p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 block">
                                Delivery Charge (₹ per Km)
                            </label>
                            <input
                                type="number"
                                name="deliveryPerKmRate"
                                value={config.deliveryPerKmRate}
                                onChange={handleChange}
                                min="0"
                                step="0.1"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="e.g. 12"
                            />
                            <p className="text-xs text-gray-500">Used for calculating normal delivery payout/fee</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 block">
                                Return Charge (₹ per Km)
                            </label>
                            <input
                                type="number"
                                name="returnPerKmRate"
                                value={config.returnPerKmRate}
                                onChange={handleChange}
                                min="0"
                                step="0.1"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="e.g. 7"
                            />
                            <p className="text-xs text-gray-500">Used for calculating rider fee on item returns</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 block">
                                Waiting Charge (₹ Base)
                            </label>
                            <input
                                type="number"
                                name="waitingCharge"
                                value={config.waitingCharge}
                                onChange={handleChange}
                                min="0"
                                step="0.1"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="e.g. 10"
                            />
                            <p className="text-xs text-gray-500">Base connection fee added to deliveries</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 block">
                                Delivery Radius (Km)
                            </label>
                            <input
                                type="number"
                                name="deliveryRadius"
                                value={config.deliveryRadius}
                                onChange={handleChange}
                                min="0"
                                step="0.1"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="e.g. 5"
                            />
                            <p className="text-xs text-gray-500">Maximum delivery distance in kilometers</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 block">
                                Try & Buy Radius (Km)
                            </label>
                            <input
                                type="number"
                                name="tryAndBuyRadius"
                                value={config.tryAndBuyRadius}
                                onChange={handleChange}
                                min="0"
                                step="0.1"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="e.g. 7"
                            />
                            <p className="text-xs text-gray-500">Threshold distance for Try & Buy availability</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 block">
                                Merchant Registration Fee (₹)
                            </label>
                            <input
                                type="number"
                                name="merchantRegistrationFee"
                                value={config.merchantRegistrationFee}
                                onChange={handleChange}
                                min="0"
                                step="1"
                                required
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="e.g. 1000"
                            />
                            <p className="text-xs text-gray-500">One-time fee for new merchants</p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default Settings;
