/**
 * Real-time delivery via socket.io. Authenticated by JWT in the handshake; each
 * connection joins a private room `user:<id>` so notifications can be pushed to a
 * specific user across all their open tabs/devices.
 *
 * NOTE: rooms are held in-memory — correct on a single instance. To scale
 * horizontally, attach the socket.io Redis adapter here (documented swap point).
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

function init(httpServer) {
  if (io) return io;

  const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000')
    .split(',').map((o) => o.trim()).filter(Boolean);

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: allowedOrigins, credentials: true },
    serveClient: false,
  });

  // Handshake auth — verify the same access token used by the REST API.
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.auth?.token
        || (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      if (!raw) return next(new Error('unauthorized'));
      const payload = jwt.verify(raw, process.env.JWT_SECRET);
      socket.userId = String(payload.sub);
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.userId) socket.join(`user:${socket.userId}`);
  });

  logger.info('[realtime] socket.io initialized');
  return io;
}

/** Emit an event to every live socket belonging to a user. Safe no-op if down. */
function emitToUser(userId, event, payload) {
  if (!io || !userId) return false;
  io.to(`user:${String(userId)}`).emit(event, payload);
  return true;
}

/** True if the user currently has at least one live socket. */
function isUserConnected(userId) {
  if (!io || !userId) return false;
  const room = io.sockets.adapter.rooms.get(`user:${String(userId)}`);
  return !!(room && room.size > 0);
}

function getIO() { return io; }

module.exports = { init, emitToUser, isUserConnected, getIO };
