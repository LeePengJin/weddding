const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST'],
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
});

// Note: userSockets Map was removed as it wasn't being used

// WebSocket authentication middleware
io.use((socket, next) => {
  // Try to get token from auth object first, then from cookies
  let token = socket.handshake.auth?.token;
  
  if (!token) {
    // Try to extract from cookie header
    const cookieHeader = socket.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }
  }
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.sub;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  const userId = socket.userId;

  // Join user's personal room for notifications
  socket.join(`user:${userId}`);

  // Handle joining conversation room
  socket.on('join-conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
  });

  // Handle leaving conversation room
  socket.on('leave-conversation', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Cleanup handled automatically by Socket.IO
  });
});

// Helper function to emit message to conversation participants
function emitNewMessage(conversationId, message) {
  io.to(`conversation:${conversationId}`).emit('new-message', message);
}

// Helper function to emit conversation update (for unread counts, etc.)
function emitConversationUpdate(userId, conversation) {
  io.to(`user:${userId}`).emit('conversation-updated', conversation);
}

// Helper function to notify user of new message
function notifyNewMessage(userId, conversationId, message) {
  io.to(`user:${userId}`).emit('new-message-notification', {
    conversationId,
    message,
  });
}

// Make io available to routes
app.set('io', io);
app.set('emitNewMessage', emitNewMessage);
app.set('emitConversationUpdate', emitConversationUpdate);
app.set('notifyNewMessage', notifyNewMessage);

server.listen(PORT, () => {
  console.log(`API on :${PORT}`);
  console.log(`WebSocket server ready`);
});
