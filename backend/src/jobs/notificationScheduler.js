/**
 * Scheduled-notification dispatcher. Every minute it picks up campaigns whose
 * scheduledAt has arrived and enqueues them for fan-out. Mirrors the cron/error
 * pattern of alertScan.js.
 */
const cron = require('node-cron');
const NotificationCampaign = require('../models/NotificationCampaign');
const dispatchQueue = require('../services/dispatchQueue');
const logger = require('../utils/logger');

let isRunning = false;

async function processDue() {
  if (isRunning) return 0;
  isRunning = true;
  try {
    const now = new Date();
    const due = await NotificationCampaign.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
    }).select('_id').lean();

    for (const c of due) {
      dispatchQueue.enqueue(c._id);
    }
    if (due.length) logger.info(`[notif-scheduler] dispatched ${due.length} scheduled campaign(s)`);
    return due.length;
  } catch (err) {
    logger.error('[notif-scheduler] failed', { err: err.message });
    return 0;
  } finally {
    isRunning = false;
  }
}

cron.schedule('* * * * *', processDue); // every minute

logger.info('[notif-scheduler] Registered — runs every minute');

module.exports = { processDue };
