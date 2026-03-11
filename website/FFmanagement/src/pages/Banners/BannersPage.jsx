import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react';
import { bannerApi } from '../../api/banner.api';
import BannerFormModal from '../../components/Banners/BannerFormModal';
import { toast } from 'react-hot-toast';

export default function BannersPage() {
    const [banners, setBanners] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);

    const fetchBanners = async () => {
        try {
            setIsLoading(true);
            const res = await bannerApi.getAllBanners();
            setBanners(res.banners || []);
        } catch (error) {
            toast.error('Failed to load banners');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    const handleSaveBanner = async (formData, id) => {
        try {
            if (id) {
                await bannerApi.updateBanner(id, formData);
                toast.success('Banner updated');
            } else {
                await bannerApi.createBanner(formData);
                toast.success('Banner created');
            }
            setIsModalOpen(false);
            fetchBanners();
        } catch (err) {
            throw err;
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this banner?")) return;
        try {
            await bannerApi.deleteBanner(id);
            toast.success('Banner deleted');
            fetchBanners();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    const toggleActive = async (id, currentState) => {
        try {
            await bannerApi.updateBanner(id, { isActive: !currentState });
            toast.success("Visibility updated");
            fetchBanners();
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Banner Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage marketing banners across different app sections</p>
                </div>
                <button
                    onClick={() => { setEditingBanner(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl transition-all font-medium text-sm shadow-sm"
                >
                    <Plus size={16} /> Add Banner
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Info</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type & Ratio</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mb-2"></div>
                                            <span className="text-slate-500 text-sm">Loading banners...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : banners.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                                <ImageIcon className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-700">No Banners Found</h3>
                                            <p className="text-slate-500 text-sm mt-1 max-w-sm">Create your first banner above.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                banners.map((banner) => (
                                    <tr key={banner._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="w-32 h-16 bg-slate-100 rounded-md overflow-hidden flex items-center justify-center border border-slate-200 shadow-inner">
                                                <img src={banner.imageUrl} alt="banner" className="w-full h-full object-contain" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{banner.title || 'Untitled'}</div>
                                            <div className="text-xs text-sky-600 max-w-[150px] truncate mt-1">
                                                <a href={banner.actionUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                                    {banner.actionUrl || 'No deep link'}
                                                </a>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-tighter bg-sky-100 text-sky-800">
                                                {banner.type}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1.5 font-semibold">Aspect: <span className="text-slate-700">{banner.ratio}</span></div>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-700">{banner.order}</td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => toggleActive(banner._id, banner.isActive)} className="group flex items-center gap-1 hover:scale-105 transition-transform" title="Click to toggle status">
                                                {banner.isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200">
                                                        <CheckCircle2 size={14} className="text-emerald-500" /> LIVE
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200">
                                                        <XCircle size={14} className="text-slate-400" /> HIDDEN
                                                    </span>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {/* Note: In your original file it used a distinct Button component, replacing with standard tailwind to match */}
                                            <button
                                                className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors border border-transparent hover:border-sky-200"
                                                onClick={() => { setEditingBanner(banner); setIsModalOpen(true); }}
                                                title="Edit details (no image change)"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                                                onClick={() => handleDelete(banner._id)}
                                                title="Delete banner permanently"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <BannerFormModal
                    open={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setEditingBanner(null); }}
                    onSave={handleSaveBanner}
                    initialData={editingBanner}
                />
            )}
        </div>
    );
}
