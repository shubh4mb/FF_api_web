import api from '../utils/axios.config.js';

export const bannerApi = {
    // Get all banners (admin)
    getAllBanners: async (type = '') => {
        const url = type ? `/admin/banners?type=${type}` : '/admin/banners';
        const response = await api.get(url);
        return response.data;
    },

    // Create new banner (FormData for image upload)
    createBanner: async (formData) => {
        const response = await api.post('/admin/banners', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // Update banner (e.g. status, order)
    updateBanner: async (id, data) => {
        const response = await api.patch(`/admin/banners/${id}`, data);
        return response.data;
    },

    // Delete banner
    deleteBanner: async (id) => {
        const response = await api.delete(`/admin/banners/${id}`);
        return response.data;
    }
};
