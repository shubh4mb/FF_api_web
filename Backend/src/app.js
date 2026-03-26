// src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error.middleware.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import merchantRoutes from './routes/merchant.routes.js';
import deliveryRiderRoutes from './routes/deliveryRider.routes.js';
import { allowedOrigins } from './config/cors.js';
import { getIO } from './config/socket.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

const app = express();

// Trust first proxy (needed for express-rate-limit behind ngrok/Render/etc.)
app.set('trust proxy', 1);

// ---- Security Middlewares ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        connectSrc: ["'self'", "https://ff-api-web-2.onrender.com", "http://localhost:5000"]
      },
    },
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
// Apply the rate limiter to all api requests
// app.use('/api/', apiLimiter);

// ---- CORS ----
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Blocked by CORS"));
  },
  credentials: true,
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization,ngrok-skip-browser-warning"
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// ---- Attach io to req (SAFE) ----
app.use((req, res, next) => {
  try {
    req.io = getIO();
  } catch {
    req.io = null; // during boot
  }
  next();
});

// ---- Health check (Render) ----
app.get('/ping', (req, res) => {
  res.send('pong');
});

// ---- Swagger API Docs ----
// Redirect /api-docs to /api-docs/ for consistent pathing
app.get('/api-docs', (req, res, next) => {
  if (!req.url.endsWith('/')) {
    return res.redirect(301, req.originalUrl + '/');
  }
  next();
});
app.use('/api-docs/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/deliveryRider', deliveryRiderRoutes);

app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// Use error handler middleware at the end of the pipeline
app.use(errorHandler);

export default app;
