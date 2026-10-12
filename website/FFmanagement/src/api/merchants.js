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
        console.log("yes reaching api : ",response.data);
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
}

export const updateMerchantById = async (id, formData) => {
    try {
        const response = await axiosInstance.patch(`/admin/updateMerchant/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
}

export const getMerchantById = async (id) => {
    try {
        const response = await axiosInstance.get(`/admin/getMerchant/${id}`);
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
}

export const verifyMerchant = async (id, isVerified, kycVerifications, rejectionReason, status) => {
    try {
        const payload = {};
        if (isVerified !== undefined) payload.isVerified = isVerified;
        if (kycVerifications !== undefined) payload.kycVerifications = kycVerifications;
        if (rejectionReason !== undefined) payload.rejectionReason = rejectionReason;
        if (status !== undefined) payload.status = status;
        const response = await axiosInstance.patch(`/admin/updateMerchant/${id}/verify`, payload);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
}

export const updateWarehouseStatus = async (id, warehouseStatus, warehouseId = null) => {
    try {
        const payload = { warehouseStatus };
        if (warehouseId) payload.warehouseId = warehouseId;
        const response = await axiosInstance.patch(`/admin/updateMerchant/${id}`, payload);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
}

export const toggleMerchantWarehouseStatus = async (merchantId, warehouseId, isActive, reason = '') => {
    try {
        const response = await axiosInstance.patch(`/admin/merchant/${merchantId}/warehouse/${warehouseId}/toggle-status`, {
            isActive,
            reason
        });
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};

export const assignWarehouseToMerchant = async (merchantId, warehouseId) => {
    try {
        const response = await axiosInstance.post(`/admin/merchant/${merchantId}/warehouse/assign`, {
            warehouseId
        });
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};

export const removeWarehouseFromMerchant = async (merchantId, warehouseId) => {
    try {
        const response = await axiosInstance.delete(`/admin/merchant/${merchantId}/warehouse/${warehouseId}`);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};

export const toggleMerchantStoreStatus = async (merchantId, isStoreActive) => {
    try {
        const payload = isStoreActive !== undefined ? { isStoreActive } : {};
        const response = await axiosInstance.patch(`/admin/merchant/${merchantId}/toggle-store-status`, payload);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response ? error.response.data : new Error('Network Error');
    }
};