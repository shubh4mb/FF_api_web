// axios.js
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://192.168.43.28:3000/api/',
  timeout: 10000,
});


export default axiosInstance;
