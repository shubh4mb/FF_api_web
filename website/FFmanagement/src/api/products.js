import axiosInstance from "@/utils/axios.config";

export const addProduct = async (productData) => {
    try {
        const response = await axiosInstance.post('merchant/addProduct', productData);
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
};
