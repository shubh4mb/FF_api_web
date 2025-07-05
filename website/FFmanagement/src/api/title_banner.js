import axiosInstance from "@/utils/axios.config";

export const addTitleBanner = async (formData) => {
    // console.log("api reaching here");
    
    try {
        const response = await axiosInstance.post("/admin/titleBanner/add", formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        return response.data;
    } catch (error) {
        console.error("Error adding title banner:", error);
        throw error;
    }
};
