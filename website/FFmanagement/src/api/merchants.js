import axiosInstance from "@/utils/axios.config";

export const addMerchant = async (formData) => {
    try {
        console.log("yes reaching api : ",formData);
        
        const response = await axiosInstance.post('/admin/addMerchant', formData,{
            headers:{
                'Content-Type': 'multipart/form-data'
            }
        });
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