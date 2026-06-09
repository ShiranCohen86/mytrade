/**
 * Channel adapters — a uniform interface so new delivery channels plug in without
 * touching the engine. `inApp` and `push` delegate to notificationService
 * (realtime + Web Push). `email`/`sms`/`whatsapp` are registered stubs that are
 * inert until configured (future-proofing the multi-channel architecture).
 *
 * Each adapter: { available(): bool, send(userId, content, meta) -> { sent, notificationId? } }
 */
const notificationService = require('../../services/notificationService');
const logger = require('../../utils/logger');

const adapters = {
  inApp: {
    available: () => true,
    async send(userId, content, meta) {
      const r = await notificationService.deliverToUser(userId, content, { inApp: true }, meta);
      return { sent: r.inApp ? 1 : 0, notificationId: r.notificationId };
    },
  },
  push: {
    available: () => true,
    async send(userId, content, meta) {
      const r = await notificationService.deliverToUser(userId, content, { push: true }, meta);
      return { sent: r.push > 0 ? 1 : 0 };
    },
  },
  // ── Future channels (registered, not yet delivering) ──────────────────────
  email: {
    available: () => false,
    async send(userId) { logger.debug?.('[automation] email channel not configured', { userId: String(userId) }); return { sent: 0 }; },
  },
  sms: {
    available: () => false,
    async send() { return { sent: 0 }; },
  },
  whatsapp: {
    available: () => false,
    async send() { return { sent: 0 }; },
  },
};

module.exports = adapters;
