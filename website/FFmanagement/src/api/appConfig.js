import axios from "@/utils/axios.config"; // Assumes you have an axios interceptor configured

/**
 * Get App Config (Delivery/Return Rates)
 */
export const getAppConfig = async () => {
    try {
        const response = await axios.get("/admin/config");
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Update App Config
 */
export const updateAppConfig = async (configData) => {
    try {
        const response = await axios.put("/admin/config", configData);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};
