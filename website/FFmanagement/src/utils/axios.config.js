// axios.js
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://ff-api-web.onrender.com/api',
  timeout: 10000,
});


export default axiosInstance;
