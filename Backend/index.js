import dotenv from 'dotenv';
// console.log('Current file:', import.meta.url);
import {Server} from 'socket.io'
 
import connectDB from './src/config/db.js';
import app from './src/app.js'; 
import { createServer } from 'http';
import { registerMerchantSockets } from './src/sockets/merchant.socket.js';
import { registerOrderSockets } from './src/sockets/order.socket.js';
import { registerUserSockets } from './src/sockets/user.socket.js';
import { registerDeliveryRiderSockets } from './src/sockets/deliveryRider.socket.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisPub, redisSub } from './src/config/redisConfig.js';
// import { createClient } from 'redis';
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = createServer(app);

// Setup Socket.IO
export const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://d560c68770a1.ngrok-free.app'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Redis adapter for scaling
io.adapter(createAdapter(redisPub, redisSub));

io.on('connection', (socket) => {
  const role = socket.handshake.query.role;

  console.log(`🔌 New socket connection: ${socket.id}, role: ${role}`);

  if (role === "merchant") {
    registerMerchantSockets(io, socket);
  } else if (role === "user") {
    registerUserSockets(io, socket);
  } else if (role === "deliveryRider") {
    registerDeliveryRiderSockets(io, socket);
    console.log(`🔌 New delivery rider socket connection: ${socket.id}`);
  }

  // Order socket listeners always active
  registerOrderSockets(io, socket);

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
  socket.on("joinOrderRoom", (orderId) => {
    socket.join(orderId);
    console.log(`✅ Socket ${socket.id} joined room ${orderId}`);
  });
  socket.on("leaveOrderRoom", (orderId) => {
    socket.leave(orderId);
    console.log(`✅ Socket ${socket.id} left room ${orderId}`);
  });
  socket.on("orderUpdate", (orderId) => {
    socket.emit("orderUpdate", orderId);
    console.log(`✅ Socket ${socket.id} received order update ${orderId}`);
  });
});

// Attach io instance to every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});