import axiosInstance from "@/utils/axios.config";

export const getSupportTickets = async (params = {}) => {
  try {
    const response = await axiosInstance.get("/admin/support/tickets", { params });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Network Error");
  }
};

export const updateTicketStatus = async (id, status) => {
  try {
    const response = await axiosInstance.patch(`/admin/support/tickets/${id}`, { status });
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
