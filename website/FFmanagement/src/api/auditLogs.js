import api from '../utils/axios.config';

/**
 * Fetch paginated audit logs from the admin api
 * @param {Object} params - Query filters (action, status, orderId, search, page, limit)
 */
export const getAuditLogs = async (params = {}) => {
  const response = await api.get('/admin/audit-logs', { params });
  return response.data || response;
};
