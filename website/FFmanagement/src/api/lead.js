import axiosInstance from "@/utils/axios.config";

export const createLeadApi = async (formData) => {
    try {
        const response = await axiosInstance.post("/admin/leads", formData);
        return response.data;
    } catch (error) {
        console.error("Error creating lead:", error);
        throw error;
    }
};

export const getLeadsApi = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/admin/leads", { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching leads:", error);
        throw error;
    }
};

export const getLeadByIdApi = async (id) => {
    try {
        const response = await axiosInstance.get(`/admin/leads/${id}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching lead details:", error);
        throw error;
    }
};

export const updateLeadApi = async (id, formData) => {
    try {
        const response = await axiosInstance.put(`/admin/leads/${id}`, formData);
        return response.data;
    } catch (error) {
        console.error("Error updating lead:", error);
        throw error;
    }
};

export const addLeadLogApi = async (id, logData) => {
    try {
        const response = await axiosInstance.post(`/admin/leads/${id}/logs`, logData);
        return response.data;
    } catch (error) {
        console.error("Error adding lead communication log:", error);
        throw error;
    }
};

export const deleteLeadApi = async (id) => {
    try {
        const response = await axiosInstance.delete(`/admin/leads/${id}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting lead:", error);
        throw error;
    }
};

export const getStaffApi = async () => {
    try {
        const response = await axiosInstance.get("/admin/leads/staff");
        return response.data;
    } catch (error) {
        console.error("Error fetching staff:", error);
        throw error;
    }
};

export const registerStaffApi = async (formData) => {
    try {
        const response = await axiosInstance.post("/auth/admin/register", formData);
        return response.data;
    } catch (error) {
        console.error("Error creating staff account:", error);
        throw error;
    }
};
