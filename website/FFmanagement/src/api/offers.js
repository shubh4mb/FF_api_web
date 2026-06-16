import axios from "@/utils/axios.config";

/**
 * ── Admin Offers API ──
 */

// Get all admin offers
export const getOffers = async (params = {}) => {
    try {
        const response = await axios.get("/admin/offers", { params });
        return response;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Get offer overview (admin + merchant)
export const getOffersOverview = async (params = {}) => {
    try {
        const response = await axios.get("/admin/offers/overview", { params });
        return response;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Get offer by ID
export const getOfferById = async (id) => {
    try {
        const response = await axios.get(`/admin/offers/${id}`);
        return response;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Create a new offer
export const createOffer = async (data) => {
    try {
        const response = await axios.post("/admin/offers", data);
        return response;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Update an offer
export const updateOffer = async (id, data) => {
    try {
        const response = await axios.put(`/admin/offers/${id}`, data);
        return response;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Toggle offer active status
export const toggleOffer = async (id) => {
    try {
        const response = await axios.patch(`/admin/offers/${id}/toggle`);
        return response;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Delete an offer
export const deleteOffer = async (id) => {
    try {
        const response = await axios.delete(`/admin/offers/${id}`);
        return response;
    } catch (error) {
        throw error.response?.data || error;
    }
};
