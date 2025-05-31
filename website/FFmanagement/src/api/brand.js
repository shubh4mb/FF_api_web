import axiosInstance from "@/utils/axios.config";

export const addBrand = async (brand) => {

    try {
        const response = await axiosInstance.post("/admin/brand/add", brand);
        return response.data;
    } catch (error) {
        console.error("Error adding brand:", error);
        throw error;
    }
};


export const getBrands = async () => {
    try {
        const response = await axiosInstance.get("/admin/brand/get");
        return response.data;
    } catch (error) {
        console.error("Error getting brands:", error);
        throw error;
    }
};