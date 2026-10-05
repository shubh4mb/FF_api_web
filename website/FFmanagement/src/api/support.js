import axiosInstance from "@/utils/axios.config";

export const getSupportTickets = async (params = {}) => {
  try {
    const response = await axiosInstance.get("/admin/support/tickets", { params });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const getTicketDetails = async (id) => {
  try {
    const response = await axiosInstance.get(`/admin/support/tickets/${id}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const updateTicketStatus = async (id, payload) => {
  try {
    const body = typeof payload === "string" ? { status: payload } : payload;
    const response = await axiosInstance.patch(`/admin/support/tickets/${id}`, body);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const getSupportStats = async () => {
  try {
    const response = await axiosInstance.get("/admin/support/stats");
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};
