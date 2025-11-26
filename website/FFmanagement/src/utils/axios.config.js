// axios.js
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://23a19704a327.ngrok-free.app/api/',
  timeout: 10000,
});
axiosInstance.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';


export default axiosInstance;
