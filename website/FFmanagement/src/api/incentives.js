// src/api/incentives.js
import axiosInstance from "@/utils/axios.config";

export const getAllIncentives = async () => {
  try {
    const response = await axiosInstance.get('admin/incentives');
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const createIncentive = async (data) => {
  try {
    const response = await axiosInstance.post('admin/incentives', data);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const updateIncentive = async (id, data) => {
  try {
    const response = await axiosInstance.put(`admin/incentives/${id}`, data);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const toggleIncentive = async (id) => {
  try {
    const response = await axiosInstance.patch(`admin/incentives/${id}/toggle`);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const deleteIncentive = async (id) => {
  try {
    const response = await axiosInstance.delete(`admin/incentives/${id}`);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Network Error');
  }
};
