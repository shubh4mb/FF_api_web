import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { bannerApi } from '../../api/banner.api';
import BannerFormModal from '../../components/Banners/BannerFormModal';
import { toast } from 'sonner';

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
                // Note: For updating with an image, your backend must support parsing the image
                // If the backend patch route doesn't use multer, you might need to handle image replacement differently
                // or send it via POST / PUT depending on API setup. Assuming it matches create.
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
            fetchBanners(); // optimistic update could be better but this is safer
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Banner Management</h1>
                <Button onClick={() => { setEditingBanner(null); setIsModalOpen(true); }} className="gap-2">
                    <Plus size={16} /> Add Banner
                </Button>
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
                                <tr><td colSpan={6} className="text-center py-8">Loading banners...</td></tr>
                            ) : banners.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No banners found. Create one above.</td></tr>
                            ) : (
                                banners.map((banner) => (
                                    <tr key={banner._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="w-32 h-16 bg-slate-100 rounded-md overflow-hidden flex items-center justify-center">
                                                <img src={banner.imageUrl} alt="banner" className="w-full h-full object-cover" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium">{banner.title || 'Untitled'}</div>
                                            <div className="text-xs text-slate-500 max-w-[150px] truncate">{banner.actionUrl || 'No link'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {banner.type}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">{banner.ratio}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono">{banner.order}</td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => toggleActive(banner._id, banner.isActive)} className="group flex items-center gap-1">
                                                {banner.isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium">
                                                        <CheckCircle2 size={14} /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full text-xs font-medium">
                                                        <XCircle size={14} /> Hidden
                                                    </span>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => { setEditingBanner(banner); setIsModalOpen(true); }}>
                                                <Pencil size={14} />
                                            </Button>
                                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(banner._id)}>
                                                <Trash2 size={14} />
                                            </Button>
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
