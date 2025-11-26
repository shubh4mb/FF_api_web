import axiosInstance from "@/utils/axios.config";

export const addZone = async (formData) => {
    // console.log("api reaching here");
    
    try {
        const response = await axiosInstance.post("/admin/zone/add", formData, {
            
          });
        return response.data;
    } catch (error) {
        console.error("Error adding zone:", error);
        throw error;
    }
};

export const checkOverlapApi = async (formData) => {
    // console.log("api reaching here");
    
    try {
        const response = await axiosInstance.post("/admin/zone/check-overlap", formData, {
            
          });
        return response.data;
    } catch (error) {
        console.error("Error checking overlap:", error);
        throw error;
    }
};

export const getZones = async () => {
    try {
        const response = await axiosInstance.get("/admin/zone");
        return response.data;
    } catch (error) {
        console.error("Error getting zones:", error);
        throw error;
    }
};

// export const deleteZone = async (id) => {
//     try {
//         const response = await axiosInstance.delete(`/admin/zone/${id}`);
//         return response.data;
//     } catch (error) {
//         console.error("Error deleting zone:", error);
//         throw error;
//     }
// };

