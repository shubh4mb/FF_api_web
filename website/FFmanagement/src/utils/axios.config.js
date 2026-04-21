import axios from 'axios';
import toast from 'react-hot-toast';

const axiosInstance = axios.create({
  baseURL: 'https://ff-api-web-2.onrender.com/api/',
  timeout: 60000,
  withCredentials: true,
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

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add a response interceptor for global error handling
axiosInstance.interceptors.response.use(
  (response) => {
    // If our backend returns ApiResponse (success: true), we just pass data
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return axiosInstance(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post('http://localhost:5000/api/auth/admin/refresh', {}, { withCredentials: true });
        
        const token = res.data?.token || res.data?.data?.token;

        if (token) {
          localStorage.setItem('adminToken', token);
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          originalRequest.headers.Authorization = `Bearer ${token}`;
          
          processQueue(null, token);
          isRefreshing = false;
          
          return axiosInstance(originalRequest);
        } else {
          throw new Error('Refresh token invalid');
        }
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        
        localStorage.removeItem('adminToken');
        toast.error('Session expired. Please log in again.');
        // Optionally redirect: window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // Default error handling for others
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
