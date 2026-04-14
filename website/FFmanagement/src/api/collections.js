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
