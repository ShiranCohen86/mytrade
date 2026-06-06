const config = require('../config');
const logger = require('../utils/logger');

const isMongoConfigured =
  config.MONGO_URI &&
  (config.MONGO_URI.startsWith('mongodb://') ||
    config.MONGO_URI.startsWith('mongodb+srv://'));

let Stock, User, mode;

if (isMongoConfigured) {
  Stock = require('../models/Stock');
  User = require('../models/User');
  mode = 'mongo';
} else {
  const local = require('./localStore');
  Stock = local.Stock;
  User = local.User;
  mode = 'local';
}

// D18: never log the raw URI — it contains credentials
function safeUri(uri) {
  return uri.replace(/:\/\/[^@]+@/, '://**:**@');
}

async function connect() {
  if (mode === 'mongo') {
    const mongoose = require('mongoose');
    const delays = [2000, 4000, 8000];
    for (let i = 0; i <= delays.length; i++) {
      try {
        await mongoose.connect(config.MONGO_URI);
        logger.info(`MongoDB connected [${safeUri(config.MONGO_URI)}]`);
        return;
      } catch (err) {
        if (i === delays.length) {
          const safeMsg = err.message.replace(config.MONGO_URI, safeUri(config.MONGO_URI));
          throw new Error(`MongoDB connection failed after ${delays.length + 1} attempts: ${safeMsg}`);
        }
        logger.warn(`DB connection attempt ${i + 1} failed`, { retryInMs: delays[i] });
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
  } else {
    logger.warn('Using local JSON storage — data will be lost on restart. Set MONGO_URI to persist data.');
    logger.info('Using local JSON storage (backend/data/db.json)');
  }
}

module.exports = { Stock, User, connect, mode };
