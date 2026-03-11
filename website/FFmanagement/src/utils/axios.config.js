import axios from 'axios';
import toast from 'react-hot-toast';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000/api/',
  timeout: 10000,
});
axiosInstance.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// Add a request interceptor to attach JWT token to admin requests
axiosInstance.interceptors.request.use(
  (config) => {
    // Check if the request is going to an admin endpoint
    if (config.url && config.url.includes('/admin')) {
      const token = localStorage.getItem('adminToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor for global error handling
axiosInstance.interceptors.response.use(
  (response) => {
    // If our backend returns ApiResponse (success: true), we just pass data
    return response.data;
  },
  (error) => {
    // Check if we hit our custom structured ApiError
    if (error.response && error.response.data) {
      const { message, errors } = error.response.data;

      const errorMessage = errors && errors.length > 0
        ? errors.join(', ')
        : message || 'An unexpected error occurred';

      toast.error(errorMessage);
    } else {
      toast.error(error.message || 'Network Error');
    }

    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use((response) => {
  // Only unwrap if it looks like an ApiResponse
  if (response.data?.success !== undefined && response.data?.data !== undefined) {
    response.data = response.data.data;
  }
  return response;
});

export default axiosInstance;
