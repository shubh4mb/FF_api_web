import dotenv from 'dotenv';
// console.log('Current file:', import.meta.url);
import {Server} from 'socket.io'
 
import connectDB from './src/config/db.js';
import app from './src/app.js'; 
import { createServer } from 'http';
import { registerMerchantSockets } from './src/sockets/merchant.socket.js';
import { registerOrderSockets } from './src/sockets/order.socket.js';
import { registerUserSockets } from './src/sockets/user.socket.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
dotenv.config();

const PORT =process.env.PORT || 5000;
const REDIS_URL = process.env.REDIS_URL;
const redisPub = createClient({ url: REDIS_URL });
const redisSub = redisPub.duplicate();
await redisPub.connect();
await redisSub.connect();

connectDB();

// Create HTTP server
const server = createServer(app);

// app.listen(PORT, () => {
//   console.log(`✅ Server running at http://localhost:${PORT}`);
// });


// app.listen(3000, '0.0.0.0', () => {
//   console.log('Server running on http://0.0.0.0:3000');
// });

// Setup socket.io

export let io;

io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174','https://d560c68770a1.ngrok-free.app'], // same as your CORS origins
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
io.adapter(createAdapter(redisPub, redisSub));

// Socket.io connection
io.on('connection', (socket) => {
  if(socket.handshake.query.role==="merchant"){
    registerMerchantSockets(io, socket);
  }
  if(socket.handshake.query.role==="user"){
    registerUserSockets(io, socket);
  }
  console.log("reaching here??")
  registerOrderSockets(io, socket);
  // console.log(`🔌 User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

app.use((req, res, next) => {
  req.io = io; // attach io instance to every request
  next();
});


server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});