// src/api/payouts.js
import axiosInstance from "@/utils/axios.config";

export const getPayouts = async () => {
  try {
    const response = await axiosInstance.get('admin/payouts');
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const getPayoutById = async (id) => {
  try {
    const response = await axiosInstance.get(`admin/payouts/${id}`);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const triggerPayout = async () => {
  try {
    const response = await axiosInstance.post('admin/payouts/trigger');
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};
