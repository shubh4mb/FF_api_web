import api from '../utils/axios.config';

export const getCancellationRequests = async () => {
  const response = await api.get('/admin/orders/cancellation-requests');
  return response.orders || response.data?.orders || [];
};

export const handleCancellationRequest = async (orderId, action) => {
  const response = await api.patch(`/admin/orders/${orderId}/cancel`, { action });
  return response.order || response.data?.order || response;
};

export const getUnresponsiveRiderReports = async () => {
  const response = await api.get('/admin/orders/unresponsive-rider-reports');
  return response.orders || response.data?.orders || [];
};

export const resolveUnresponsiveRider = async (orderId, action) => {
  const response = await api.patch(`/admin/orders/${orderId}/resolve-unresponsive-rider`, { action });
  return response.order || response.data?.order || response;
};

/**
 * Fetch all live orders across all merchants with optional filters (merchantId, status, search, date)
 */
export const getLiveAdminOrders = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.merchantId && params.merchantId !== 'all') query.append('merchantId', params.merchantId);
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.date) query.append('date', params.date);
  if (params.limit) query.append('limit', params.limit);
  if (params.page) query.append('page', params.page);

  const queryString = query.toString();
  const url = `/admin/orders${queryString ? `?${queryString}` : ''}`;
  const response = await api.get(url);
  return response || {};
};

/**
 * Fetch full order detail by ID
 */
export const getAdminOrderById = async (orderId) => {
  const response = await api.get(`/admin/orders/${orderId}`);
  return response.order || response.data?.order || response;
};

