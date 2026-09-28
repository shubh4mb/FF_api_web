import axios from 'axios';
import toast from 'react-hot-toast';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/';

// 1. Decode any URL encoded characters (e.g., %22 -> ")
try {
  API_URL = decodeURIComponent(API_URL);
} catch (e) {}

// 2. Clean up ALL combinations of leading/trailing quotes and spaces
if (API_URL) {
  API_URL = API_URL.replace(/^['"\s]+|['"\s]+$/g, '');

  // 3. Fallback: If it still starts with literal '%22' characters, strip them
  if (API_URL.startsWith('%22')) {
    API_URL = API_URL.substring(3);
  }
  if (API_URL.endsWith('%22')) {
    API_URL = API_URL.substring(0, API_URL.length - 3);
  }

  // 4. Ensure the base URL ends with /api/
  if (!API_URL.endsWith('/api/')) {
    if (API_URL.endsWith('/')) {
      API_URL += 'api/';
    } else {
      API_URL += '/api/';
    }
  }
}

console.log('Final Sanitized Backend API Base URL:', API_URL);

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  withCredentials: true,
});
axiosInstance.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// Add a request interceptor to attach JWT token to all outgoing requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
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
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const clearAdminAuthSession = () => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminRefreshToken');
  localStorage.removeItem('adminUser');
  delete axiosInstance.defaults.headers.common['Authorization'];
};

// Global response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    // If backend returns ApiResponse (success: true), unwrap to response.data
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('auth/admin/login') ||
      url.includes('auth/admin/refresh') ||
      url.includes('auth/admin/register');

    // Handle 401 Unauthorized for non-auth endpoints
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest._retry = true;
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = localStorage.getItem('adminRefreshToken');

        // Use standalone axios instance to prevent recursive interceptor calls
        const refreshResponse = await axios.post(
          `${API_URL}auth/admin/refresh`,
          {
            adminRefreshToken: storedRefreshToken,
            refreshToken: storedRefreshToken,
          },
          {
            withCredentials: true,
            headers: {
              'ngrok-skip-browser-warning': 'true',
            },
          }
        );

        const payload = refreshResponse.data?.data || refreshResponse.data;
        const newAccessToken = payload?.token;
        const newRefreshToken = payload?.adminRefreshToken || payload?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('adminToken', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('adminRefreshToken', newRefreshToken);
          }

          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          isRefreshing = false;

          return axiosInstance(originalRequest);
        } else {
          throw new Error('No access token returned from refresh');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;

        clearAdminAuthSession();

        if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin/login')) {
          toast.error('Session expired. Please log in again.');
          window.location.href = '/admin/login';
        }

        return Promise.reject(refreshErr);
      }
    }

    // If 401 occurred on an already retried request
    if (error.response?.status === 401 && originalRequest._retry && !isAuthEndpoint) {
      clearAdminAuthSession();

      if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin/login')) {
        toast.error('Session expired. Please log in again.');
        window.location.href = '/admin/login';
      }
      return Promise.reject(error);
    }

    // Default error handling for non-401 errors
    if (error.response?.status !== 401) {
      if (error.response?.data) {
        const { message, errors } = error.response.data;
        const errorMessage =
          errors && errors.length > 0
            ? errors.join(', ')
            : message || 'An unexpected error occurred';
        toast.error(errorMessage);
      } else if (error.message && error.message !== 'canceled') {
        toast.error(error.message || 'Network Error');
      }
    }

    return Promise.reject(error);
  }
);

export { API_URL };
export default axiosInstance;
