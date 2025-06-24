// src/app.js
import express from 'express';
import cors from 'cors';
// const productRoutes = require('./routes/product.routes');
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import merchantRoutes from './routes/merchant.routes.js';
const app = express();

app.use(cors());
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
