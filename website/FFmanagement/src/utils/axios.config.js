// axios.js
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000/api/',
  timeout: 10000,
});
axiosInstance.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';


export default axiosInstance;
