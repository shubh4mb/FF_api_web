// src/app.js
import express from 'express';
import cors from 'cors';
// const productRoutes = require('./routes/product.routes');
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import merchantRoutes from './routes/merchant.routes.js';
const app = express();

const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json()); 

app.get('/ping', (req, res) => {
  res.send('pong');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant',merchantRoutes)
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

export default app;
