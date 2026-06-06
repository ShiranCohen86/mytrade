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

function defaultUser(data) {
  return {
    watchlist: [],
    portfolio: [],
    priceAlerts: [],
    notes: [],
    ...data,
  };
}

// Returns a user object that mirrors Mongoose's save() pattern
function hydrateUser(raw) {
  const user = defaultUser(raw || {});
  user.save = function () {
    const db = readDb();
    const { save: _save, ...plain } = this; // eslint-disable-line no-unused-vars
    db.user = plain;
    writeDb(db);
    return Promise.resolve(this);
  }.bind(user);
  return user;
}

// Mimics Mongoose's findOne().lean() chaining pattern
function leanResult(doc) {
  return { lean: () => Promise.resolve(doc), select: () => ({ lean: () => Promise.resolve(doc) }) };
}

const Stock = {
  findOneAndUpdate(filter, update, _opts) {
    const db = readDb();
    const ticker = filter.ticker;
    const idx = db.stocks.findIndex((s) => s.ticker === ticker);
    const now = new Date().toISOString();

    // Handle Mongoose-style update operators
    const $set = update.$set || {};
    const $setOnInsert = update.$setOnInsert || {};
    const $push = update.$push || {};

    let existing = idx >= 0 ? db.stocks[idx] : null;

    // Apply $push operators
    const pushed = {};
    for (const [key, val] of Object.entries($push)) {
      const current = existing ? (existing[key] || []) : [];
      if (val.$each !== undefined) {
        let updated = [...current, ...val.$each];
        if (val.$slice !== undefined) {
          updated = updated.slice(val.$slice);
        }
        pushed[key] = updated;
      } else {
        pushed[key] = [...current, val];
      }
    }

    if (existing) {
      db.stocks[idx] = {
        ...existing,
        ...$set,
        ...pushed,
        updatedAt: now,
      };
      writeDb(db);
      return Promise.resolve(db.stocks[idx]);
    } else {
      const doc = {
        ticker,
        ...$set,
        ...$setOnInsert,
        ...pushed,
        createdAt: now,
        updatedAt: now,
      };
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
    return {
      select: () => ({ lean: () => Promise.resolve(results) }),
      lean: () => Promise.resolve(results),
    };
  },

  deleteOne(filter) {
    const db = readDb();
    const before = db.stocks.length;
    db.stocks = db.stocks.filter((s) => s.ticker !== filter.ticker);
    writeDb(db);
    return Promise.resolve({ deletedCount: before - db.stocks.length });
  },
};

const User = {
  countDocuments() {
    const db = readDb();
    return Promise.resolve(db.user ? 1 : 0);
  },

  create(data) {
    const db = readDb();
    db.user = defaultUser(data);
    writeDb(db);
    return Promise.resolve(hydrateUser(db.user));
  },

  findOne() {
    const db = readDb();
    return Promise.resolve(hydrateUser(db.user));
  },

  updateOne(_filter, update) {
    const db = readDb();
    if (!db.user) db.user = defaultUser({});

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
