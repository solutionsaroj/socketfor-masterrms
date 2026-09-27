const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enable CORS for all HTTP requests
app.use(cors());
app.use(express.json());

// Initialize Socket.io with permissive CORS for development and deployment
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Support both WebSockets and HTTP long-polling fallback
  transports: ['websocket', 'polling'],
});

// Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Socket.IO Server is running successfully!',
    timestamp: new Date().toISOString(),
    connectedClients: io.engine.clientsCount,
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Socket.IO Event Handlers
io.on('connection', (socket) => {
  console.log(`[+] Client connected: ${socket.id} (Total: ${io.engine.clientsCount})`);

  // Send a welcome event to the newly connected client
  socket.emit('welcome', {
    message: 'Connected to Socket.IO server!',
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  });

  // Echo test: client sends 'ping', server responds with 'pong'
  socket.on('ping_test', (data) => {
    socket.emit('pong_test', {
      received: data,
      timestamp: new Date().toISOString(),
    });
  });

  // Global broadcast message handler
  socket.on('send_message', (payload) => {
    console.log(`[Message from ${socket.id}]:`, payload);
    // Broadcast to all connected clients including sender
    io.emit('receive_message', {
      senderId: socket.id,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  });

  // Room support: Join a specific room
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    console.log(`[Room] ${socket.id} joined room: ${roomName}`);
    socket.to(roomName).emit('user_joined', { socketId: socket.id, room: roomName });
  });

  // Room message handler
  socket.on('send_room_message', ({ room, message }) => {
    io.to(room).emit('receive_room_message', {
      senderId: socket.id,
      room,
      message,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle client disconnection
  socket.on('disconnect', (reason) => {
    console.log(`[-] Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

// Port and Host Configuration (Render binds to 0.0.0.0 and assigns PORT dynamically)
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(`🚀 Socket.IO Server running on http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket ready for incoming connections`);
  console.log(`===============================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
