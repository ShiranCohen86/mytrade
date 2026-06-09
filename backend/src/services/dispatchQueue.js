/**
 * Dispatch queue abstraction. Today: a simple in-process queue that serializes
 * campaign fan-outs (so two large sends don't thrash the DB/push provider at
 * once). Tomorrow: swap the body of enqueue() for BullMQ/Redis without touching
 * any callers — the contract is just `enqueue(campaignId)`.
 */
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

let chain = Promise.resolve();

/** Queue a campaign for dispatch. Returns a promise that resolves when it runs. */
function enqueue(campaignId) {
  chain = chain
    .then(() => notificationService.dispatch(campaignId))
    .catch((err) => logger.error('[dispatch-queue] failed', { campaignId: String(campaignId), err: err.message }));
  return chain;
}

module.exports = { enqueue };
