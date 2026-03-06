import { useState, useEffect } from "react";
import { getAppConfig, updateAppConfig } from "../../api/appConfig"; // We'll create this API file next
import { Save, Loader2, AlertCircle } from "lucide-react";

const Settings = () => {
    const [config, setConfig] = useState({
        deliveryPerKmRate: 12,
        returnPerKmRate: 7,
        waitingCharge: 10,
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
                    deliveryPerKmRate: data.config.deliveryPerKmRate,
                    returnPerKmRate: data.config.returnPerKmRate,
                    waitingCharge: data.config.waitingCharge,
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
        const { name, value } = e.target;
        setConfig((prev) => ({
            ...prev,
            [name]: Number(value),
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
            // Clear success message after 3 seconds
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
            <div className="flex justify-center items-center h-full">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
                    <p className="text-gray-500 mt-1">Configure global platform charges and delivery rates</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Delivery Configuration</h2>
                    <p className="text-sm text-gray-500">Set the per-kilometer charges for rider payouts and customer fees.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3">
                            <AlertCircle size={20} />
                            <p>{error}</p>
                        </div>
                    )}

                    {successMsg && (
                        <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3">
                            <AlertCircle size={20} className="text-green-500" />
                            <p>{successMsg}</p>
                        </div>
                    )}

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
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                </form>
            </div>
        </div>
    );
};

export default Settings;
