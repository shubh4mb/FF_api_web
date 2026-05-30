import api from '../utils/axios.config';

export const getDashboardStats = async () => {
  const response = await api.get('/admin/dashboard/stats');
  // Return stats and charts from response
  return response.data || response;
};
