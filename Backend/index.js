// index.js
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';

import connectDB from './src/config/db.js';
import app from './src/app.js';

import { allowedOrigins } from './src/config/cors.js';
import { setIO } from './src/config/socket.js';

import { matchQueuedOrders } from './src/helperFns/orderFns.js';
import { registerMerchantSockets } from './src/sockets/merchant.socket.js';
import { registerOrderSockets } from './src/sockets/order.socket.js';
import { registerUserSockets } from './src/sockets/user.socket.js';
import { registerDeliveryRiderSockets } from './src/sockets/deliveryRider.socket.js';

const PORT = process.env.PORT || 5000;

// Connect DB
connectDB();

// Create HTTP server
const server = createServer(app);

// Create Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// 🔥 Make io globally accessible (NO circular import)
setIO(io);

// ---- GLOBAL EMIT HOOK (your matcher logic preserved) ----
const originalEmit = io.emit.bind(io);

io.emit = function (event, ...args) {
  if (
    event.startsWith('orderQueued:') ||
    event.startsWith('riderAvailable:') ||
    event.startsWith('riderFreed:')
  ) {
    const zoneId = event.split(':')[1];
    console.log(`🎯 Matcher triggered for zone ${zoneId}`);
    matchQueuedOrders(zoneId).catch(console.error);
  }

  return originalEmit(event, ...args);
};

// ---- SOCKET CONNECTIONS ----
io.on('connection', (socket) => {
  const role = socket.handshake.query.role;
  console.log(`🔌 Socket connected: ${socket.id}, role: ${role}`);

  if (role === "merchant") {
    registerMerchantSockets(io, socket);
  } else if (role === "user") {
    registerUserSockets(io, socket);
  } else if (role === "deliveryRider") {
    registerDeliveryRiderSockets(io, socket);
  }

  registerOrderSockets(io, socket);

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });

  socket.on("joinOrderRoom", (orderId) => socket.join(orderId));
  socket.on("leaveOrderRoom", (orderId) => socket.leave(orderId));
});

// Start server (Render compatible)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
