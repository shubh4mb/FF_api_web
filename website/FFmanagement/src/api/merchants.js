import axiosInstance from "@/utils/axios.config";

export const addMerchant = async (formData) => {
    try {
        const response = await axiosInstance.post('/merchant/add', formData);
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
}

export const getMerchants = async () => {
    try {
        const response = await axiosInstance.get('/admin/getMerchants');
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
}