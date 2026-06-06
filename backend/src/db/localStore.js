const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { stocks: [], user: null };
  }
}

function writeDb(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Mimics Mongoose's findOne().lean() chaining pattern
function leanResult(doc) {
  return { lean: () => Promise.resolve(doc) };
}

const Stock = {
  findOneAndUpdate(filter, update, _opts) {
    const db = readDb();
    const ticker = filter.ticker;
    const idx = db.stocks.findIndex((s) => s.ticker === ticker);
    const now = new Date().toISOString();
    const doc = { ...update, lastUpdated: now, updatedAt: now, createdAt: now };

    if (idx >= 0) {
      db.stocks[idx] = { ...db.stocks[idx], ...doc, createdAt: db.stocks[idx].createdAt };
      writeDb(db);
      return Promise.resolve(db.stocks[idx]);
    } else {
      db.stocks.push(doc);
      writeDb(db);
      return Promise.resolve(doc);
    }
  },

  findOne(filter) {
    const db = readDb();
    const doc = db.stocks.find((s) => s.ticker === filter.ticker) || null;
    return leanResult(doc);
  },

  find(filter) {
    const db = readDb();
    let results = db.stocks;
    if (filter?.ticker?.$in) {
      results = results.filter((s) => filter.ticker.$in.includes(s.ticker));
    }
    return { lean: () => Promise.resolve(results) };
  },
};

const User = {
  countDocuments() {
    const db = readDb();
    return Promise.resolve(db.user ? 1 : 0);
  },

  create(data) {
    const db = readDb();
    db.user = { ...data };
    writeDb(db);
    return Promise.resolve(db.user);
  },

  findOne() {
    const db = readDb();
    return Promise.resolve(db.user || { watchlist: [] });
  },

  updateOne(_filter, update) {
    const db = readDb();
    if (!db.user) db.user = { watchlist: [] };

    if (update.$addToSet?.watchlist) {
      const t = update.$addToSet.watchlist;
      if (!db.user.watchlist.includes(t)) db.user.watchlist.push(t);
    }
    if (update.$pull?.watchlist) {
      const t = update.$pull.watchlist;
      db.user.watchlist = db.user.watchlist.filter((w) => w !== t);
    }
    writeDb(db);
    return Promise.resolve({ modifiedCount: 1 });
  },
};

module.exports = { Stock, User };
