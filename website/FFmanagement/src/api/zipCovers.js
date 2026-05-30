import api from '../utils/axios.config';

export const getAllZipCoverOrders = async () => {
  const response = await api.get('/admin/zip-covers');
  return response.orders || response.data?.orders || response; // fallback depending on interceptor
};

export const updateZipCoverOrderStatus = async (id, status, remarks) => {
  const response = await api.patch(`/admin/zip-covers/${id}/status`, { status, remarks });
  return response.order || response.data?.order || response;
};
