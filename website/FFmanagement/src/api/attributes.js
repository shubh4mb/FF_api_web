import axiosInstance from "@/utils/axios.config";

export const getAttributes = async (categoryId = '') => {
    try {
        const url = categoryId ? `/admin/attributes?categoryId=${categoryId}` : '/admin/attributes';
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};

export const createAttribute = async (attributeData) => {
    try {
        const response = await axiosInstance.post('/admin/attributes', attributeData);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};

export const updateAttribute = async (attributeId, attributeData) => {
    try {
        const response = await axiosInstance.patch(`/admin/attributes/${attributeId}`, attributeData);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};

export const deleteAttribute = async (attributeId) => {
    try {
        const response = await axiosInstance.delete(`/admin/attributes/${attributeId}`);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};
