import axios from "@/utils/axios.config";

/**
 * ── Admin Collections API (Form Data for File Uploads) ──
 */

// Get all collections
export const getCollections = async () => {
    try {
        const response = await axios.get("/admin/getCollections");
        return response.data; 
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Create a new collection
export const createCollection = async (formData) => {
    try {
        // formData can contain 'bannerImage' as a File
        const response = await axios.post("/admin/addCollection", formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Update a collection
export const updateCollection = async (id, formData) => {
    try {
        const response = await axios.patch(`/admin/updateCollection/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Delete a collection
export const deleteCollection = async (id) => {
    try {
        const response = await axios.delete(`/admin/deleteCollection/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Get single collection
export const getCollectionById = async (id) => {
    try {
        const response = await axios.get(`/admin/collection/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Inspect products inside a collection
export const getCollectionProducts = async (id, params = {}) => {
    try {
        const response = await axios.get(`/admin/collection/${id}/products`, { params });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Toggle Pin Product in Collection
export const togglePinProduct = async (id, productId) => {
    try {
        const response = await axios.post(`/admin/collection/${id}/toggle-pin`, { productId });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Exclude Product from Collection
export const excludeProduct = async (id, { productId, styleGroupId }) => {
    try {
        const response = await axios.post(`/admin/collection/${id}/exclude-product`, { productId, styleGroupId });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Bulk Add Products to Collection
export const bulkAddProductsToCollection = async (id, { productIds, styleGroupIds }) => {
    try {
        const response = await axios.post(`/admin/collection/${id}/bulk-add-products`, { productIds, styleGroupIds });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

