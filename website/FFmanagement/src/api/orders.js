import api from '../utils/axios.config';

export const getCancellationRequests = async () => {
  const response = await api.get('/admin/orders/cancellation-requests');
  return response.orders || response.data?.orders || [];
};

export const handleCancellationRequest = async (orderId, action) => {
  const response = await api.patch(`/admin/orders/${orderId}/cancel`, { action });
  return response.order || response.data?.order || response;
};
