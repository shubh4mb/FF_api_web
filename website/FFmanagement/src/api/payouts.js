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

export const getPendingPayouts = async (ownerType = '') => {
  try {
    const url = ownerType ? `admin/payouts/pending?ownerType=${ownerType}` : `admin/payouts/pending`;
    const response = await axiosInstance.get(url);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const markPayoutPaid = async (id) => {
  try {
    const response = await axiosInstance.post(`admin/payouts/${id}/mark-paid`);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};
