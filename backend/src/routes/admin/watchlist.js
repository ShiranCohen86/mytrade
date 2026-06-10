const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const User = require('../../models/User');
const WatchlistItem = require('../../models/WatchlistItem');
const adminAuth = require('../../middleware/adminAuth');
const audit = require('../../services/auditService');

// GET /admin/watchlists — query all watchlist items across all users
router.get('/', adminAuth('watchlist.edit'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.userId) {
      if (!Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({ error: 'Invalid user id.' });
      }
      filter.userId = req.query.userId;
    }
    if (req.query.symbol) filter.symbol = { $regex: req.query.symbol.toUpperCase(), $options: 'i' };
    if (req.query.isDisabled === 'true') filter.isDisabled = true;
    if (req.query.isDisabled === 'false') filter.isDisabled = false;

    const [items, total] = await Promise.all([
      WatchlistItem.find(filter)
        .populate('userId', 'email displayName')
        .populate('disabledBy', 'email displayName')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WatchlistItem.countDocuments(filter),
    ]);

    res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/watchlists/:userId — all items for a specific user
router.get('/:userId', adminAuth('watchlist.edit'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    const items = await WatchlistItem.find({ userId: req.params.userId })
      .sort({ isDisabled: 1, updatedAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /admin/watchlists/:userId/restore/:symbol — re-enable a disabled item
router.post('/:userId/restore/:symbol', adminAuth('watchlist.edit'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');
    const item = await WatchlistItem.findOneAndUpdate(
      { userId: req.params.userId, symbol, isDisabled: true },
      { isDisabled: false, disabledAt: null, disabledBy: null, disableReason: '', $inc: { addCount: 1 } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found or already active.' });

    // Also restore in User.watchlist array
    await User.updateOne({ _id: req.params.userId }, { $addToSet: { watchlist: symbol } });

    await audit.logAdmin(req, 'admin.watchlist.restore', req.params.userId, {
      symbol,
    });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /admin/watchlists/:userId/disable/:symbol — force-disable an item
router.post('/:userId/disable/:symbol', adminAuth('watchlist.edit'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');
    const reason = String(req.body.reason || '').slice(0, 200);

    const item = await WatchlistItem.findOneAndUpdate(
      { userId: req.params.userId, symbol, isDisabled: false },
      {
        isDisabled: true,
        disabledAt: new Date(),
        disabledBy: req.adminUser.id,
        disableReason: reason,
      },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found or already disabled.' });

    // Also remove from User.watchlist array
    await User.updateOne({ _id: req.params.userId }, { $pull: { watchlist: symbol } });

    await audit.logAdmin(req, 'admin.watchlist.force_disable', req.params.userId, {
      symbol, reason,
    }, 'warning');

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
