// axios.js
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://192.168.0.102:3000/api/',
  timeout: 10000,
});


export default axiosInstance;
