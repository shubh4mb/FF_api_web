import React, { useState } from 'react';
import Modal from '../../components/Modal';
import Cropper from 'react-easy-crop';
import { useImageCropper } from '../../hooks/useImageCropper';
import { toast } from 'react-hot-toast';

const RATIOS = {
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '1:1': 1 / 1,
    '27:7': 27 / 7,
    '25:9': 25 / 9,
    '3:4': 3 / 4,
};

export default function BannerFormModal({ open, onClose, onSave, initialData }) {
    const isEditing = !!initialData;
    const cropper = useImageCropper();

    const [formData, setFormData] = useState(initialData || {
        title: '',
        type: 'home_hero',
        ratio: '16:9',
        actionUrl: '',
        order: 0,
        isActive: true,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => cropper.setImageSrc(reader.result));
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const submitData = new FormData();
            submitData.append('title', formData.title);
            submitData.append('type', formData.type);
            submitData.append('ratio', formData.ratio);
            submitData.append('actionUrl', formData.actionUrl);
            submitData.append('order', formData.order);
            submitData.append('isActive', formData.isActive);

            if (cropper.imageSrc) {
                const croppedBlob = await cropper.showCroppedImage();
                if (croppedBlob) {
                    submitData.append('image', croppedBlob, 'banner.jpg');
                } else {
                    toast.error("Failed to crop image");
                    setIsSubmitting(false);
                    return;
                }
            } else if (!isEditing) {
                toast.error('Please upload an image for the banner');
                setIsSubmitting(false);
                return;
            }

            await onSave(submitData, isEditing ? initialData._id : null);

            cropper.resetCropper();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Failed to save banner');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <Modal onClose={() => { cropper.resetCropper(); onClose(); }}>
            <div className="p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit Banner' : 'Create New Banner'}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <select
                                className="w-full border rounded-md p-2 h-10"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                required
                            >
                                <option value="home_hero">Home Hero</option>
                                <option value="home_middle">Home Middle</option>
                                <option value="explore_hero">Explore Top</option>
                                <option value="category_banner">Category Banner</option>
                                <option value="promotional">Promotional</option>
                                <option value="new_arrivals_banner">New Arrivals Section</option>
                                <option value="trending_banner">Trending Now Section</option>
                                <option value="recommended_banner">You May Like Section</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Aspect Ratio</label>
                            <select
                                className="w-full border rounded-md p-2 h-10"
                                value={formData.ratio}
                                onChange={e => setFormData({ ...formData, ratio: e.target.value })}
                                required
                            >
                                <option value="16:9">16:9 (Widescreen)</option>
                                <option value="21:9">21:9 (Ultrawide)</option>
                                <option value="27:7">25:9 (Ultrawide)</option>
                                <option value="4:3">4:3 (Standard)</option>
                                <option value="1:1">1:1 (Square)</option>
                                <option value="3:4">3:4 (Portrait)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Title (Optional)</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2 h-10 border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Internal identifier"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Action URL (Optional)</label>
                            <input
                                type="text"
                                className="w-full border rounded-md p-2 h-10 border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                value={formData.actionUrl}
                                onChange={e => setFormData({ ...formData, actionUrl: e.target.value })}
                                placeholder="/category/mens"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sort Order</label>
                            <input
                                type="number"
                                className="w-full border rounded-md p-2 h-10 border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
                                value={formData.order}
                                onChange={e => setFormData({ ...formData, order: Number(e.target.value) })}
                            />
                        </div>

                        <div className="space-y-2 flex items-center mt-8 gap-2">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            <label htmlFor="isActive" className="cursor-pointer mb-0 text-sm font-medium">Active / Visible</label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium block">Image</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 border border-slate-200 p-2 rounded-lg cursor-pointer"
                        />
                    </div>

                    {cropper.imageSrc ? (
                        <div className="relative w-full h-64 bg-slate-100 rounded-md overflow-hidden mt-4">
                            <Cropper
                                image={cropper.imageSrc}
                                crop={cropper.crop}
                                zoom={cropper.zoom}
                                aspect={RATIOS[formData.ratio]}
                                onCropChange={cropper.setCrop}
                                onCropComplete={cropper.onCropComplete}
                                onZoomChange={cropper.setZoom}
                            />
                        </div>
                    ) : isEditing && initialData.imageUrl ? (
                        <div className="mt-4">
                            <label className="text-sm text-slate-500 mb-2 block font-medium">Current Image (Upload new to replace)</label>
                            <img src={initialData.imageUrl} alt="Current" className="w-full object-cover rounded-md max-h-64" style={{ aspectRatio: RATIOS[formData.ratio] }} />
                        </div>
                    ) : null}

                    <div className="pt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => { cropper.resetCropper(); onClose(); }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-slate-900 rounded-lg text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Banner'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
