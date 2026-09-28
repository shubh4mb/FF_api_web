// src/api/transactions.js
import axiosInstance from "@/utils/axios.config";

export const getTransactions = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
        query.append(key, params[key]);
      }
    });

    const response = await axiosInstance.get(`admin/transactions?${query.toString()}`);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const createManualTransaction = async (formDataOrData) => {
  try {
    const isFormData = formDataOrData instanceof FormData;
    const config = isFormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : {};

    const response = await axiosInstance.post("admin/transactions/manual", formDataOrData, config);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const searchRecipients = async (type = "merchant", query = "") => {
  try {
    const response = await axiosInstance.get(
      `admin/transactions/recipients?type=${encodeURIComponent(type)}&query=${encodeURIComponent(query)}`
    );
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const getTransactionById = async (id) => {
  try {
    const response = await axiosInstance.get(`admin/transactions/${id}`);
    return response;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};
