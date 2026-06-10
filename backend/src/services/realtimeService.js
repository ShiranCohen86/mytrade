/**
 * Real-time delivery via socket.io. Authenticated by JWT in the handshake; each
 * connection joins a private room `user:<id>` so notifications can be pushed to a
 * specific user across all their open tabs/devices.
 *
 * Rooms are held in-memory — correct on a single instance. Set REDIS_URL to attach
 * the socket.io Redis adapter and fan out events across multiple instances.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

let io = null;

// Env-gated horizontal-scaling support. No-op without REDIS_URL; best-effort so a
// Redis hiccup degrades to single-instance rather than breaking realtime. Lazy
// requires the adapter + client so they're only loaded when actually enabled.
function attachRedisAdapter(server) {
  const url = process.env.REDIS_URL;
  if (!url) return;
  (async () => {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      const pubClient = createClient({ url });
      const subClient = pubClient.duplicate();
      pubClient.on('error', (e) => logger.warn('[realtime] redis pub error', { err: e.message }));
      subClient.on('error', (e) => logger.warn('[realtime] redis sub error', { err: e.message }));
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      logger.info('[realtime] Redis adapter attached — multi-instance fan-out enabled');
    } catch (err) {
      logger.warn('[realtime] REDIS_URL set but Redis adapter unavailable — continuing single-instance', { err: err.message });
    }
  })();
}

function init(httpServer) {
  if (io) return io;

  const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000')
    .split(',').map((o) => o.trim()).filter(Boolean);

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: allowedOrigins, credentials: true },
    serveClient: false,
  });

  attachRedisAdapter(io);

  // Handshake auth — verify the same access token used by the REST API, and
  // mirror the REST middleware's live suspension/existence check. Without this a
  // suspended or deleted user keeps a live socket (and their realtime feed) for
  // as long as the connection stays open, well past the 15-min token TTL.
  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth?.token
        || (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      if (!raw) return next(new Error('unauthorized'));
      const payload = jwt.verify(raw, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('isSuspended').lean();
      if (!user || user.isSuspended) return next(new Error('unauthorized'));
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
