// src/app.js
import express from 'express';
import cors from 'cors';
// const productRoutes = require('./routes/product.routes');
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import merchantRoutes from './routes/merchant.routes.js';
import deliveryRiderRoutes from './routes/deliveryRider.routes.js';
import { allowedOrigins } from './config/cors.js';
import {io} from '../index.js';
const app = express();



app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Blocked by CORS: " + origin));
  },
  credentials: true,
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization,ngrok-skip-browser-warning"
}));

// app.options("/*", cors());



app.use(express.json()); 

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get('/ping', (req, res) => {    
  res.send('pong');
});
 
// Routes

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant',merchantRoutes)
app.use('/api/deliveryRider',deliveryRiderRoutes)
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

export default app;
