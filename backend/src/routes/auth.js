const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('../config/passport');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const audit = require('../services/auditService');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_COOKIE = 'rt';

function issueTokens(user) {
  const payload = { sub: user.id, email: user.email, displayName: user.displayName };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  // tv (token version) lets logout invalidate every outstanding refresh token.
  const refreshToken = jwt.sign(
    { sub: user.id, tv: user.tokenVersion ?? 0 },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
  return { accessToken, refreshToken };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/auth/refresh',
  });
}

function safeUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
    onboardingDone: user.onboardingDone,
    isGoogleAccount: Boolean(user.googleId),
    role: user.role || 'user',
    isSuspended: Boolean(user.isSuspended),
    createdAt: user.createdAt,
  };
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName: (displayName || '').trim() || email.split('@')[0],
    });

    const { accessToken, refreshToken } = issueTokens(user);
    setRefreshCookie(res, refreshToken);

    audit.logUser(
      { user: { id: user.id, email: user.email }, ip: req.ip, headers: req.headers, id: req.id },
      'auth.register',
      { email: user.email, displayName: user.displayName }
    );

    res.status(201).json({ user: safeUserResponse(user), accessToken });
  } catch (err) {
    logger.error('POST /auth/register', { err: err.message });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /auth/login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      audit.log({
        actionType: 'auth.login_failed',
        actor: { type: 'user', id: null, email: req.body?.email || '', role: 'user' },
        userId: null,
        metadata: { email: req.body?.email || '', reason: info?.message || 'Invalid credentials' },
        severity: 'warning',
        req,
      });
      return res.status(401).json({ error: info?.message || 'Invalid credentials.' });
    }

    if (user.isSuspended) {
      audit.log({
        actionType: 'auth.login_blocked',
        actor: { type: 'user', id: user.id, email: user.email, role: user.role || 'user' },
        userId: user.id,
        metadata: { email: user.email, reason: 'suspended' },
        severity: 'warning',
        req,
      });
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    try {
      const { accessToken, refreshToken } = issueTokens(user);
      setRefreshCookie(res, refreshToken);

      audit.log({
        actionType: 'auth.login',
        actor: { type: 'user', id: user.id, email: user.email, role: user.role || 'user' },
        userId: user.id,
        metadata: { email: user.email },
        req,
      });

      res.json({ user: safeUserResponse(user), accessToken });
    } catch (tokenErr) {
      logger.error('POST /auth/login token issue', { err: tokenErr.message });
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  })(req, res, next);
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  // Identify the user from the access token (best-effort) and bump tokenVersion,
  // which invalidates every outstanding refresh token for them.
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      await User.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
      audit.log({
        actionType: 'auth.logout',
        actor: { type: 'user', id: payload.sub, email: payload.email, role: 'user' },
        userId: payload.sub,
        req,
      });
    } catch { /* token missing/expired — still clear the cookie below */ }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/auth/refresh' });
  res.json({ ok: true });
});

// POST /auth/refresh — issue new access token from refresh cookie
router.post('/refresh', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    User.findById(payload.sub).then((user) => {
      if (!user) return res.status(401).json({ error: 'User not found.' });
      if (user.isSuspended) {
        res.clearCookie(REFRESH_COOKIE, { path: '/auth/refresh' });
        return res.status(403).json({ error: 'Account is suspended.' });
      }
      // Reject refresh tokens issued before the user's last logout / revocation.
      if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
        res.clearCookie(REFRESH_COOKIE, { path: '/auth/refresh' });
        return res.status(401).json({ error: 'Session expired.' });
      }
      const { accessToken, refreshToken: newRefresh } = issueTokens(user);
      setRefreshCookie(res, newRefresh);
      res.json({ accessToken });
    }).catch(() => res.status(500).json({ error: 'Refresh failed.' }));
  } catch {
    res.status(401).json({ error: 'Invalid refresh token.' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: safeUserResponse(user) });
  } catch (err) {
    logger.error('GET /auth/me', { err: err.message });
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// PUT /auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName, avatar, onboardingDone } = req.body;
    const update = {};
    if (displayName !== undefined) update.displayName = String(displayName).trim().slice(0, 60);
    if (avatar !== undefined) update.avatar = String(avatar).slice(0, 500);
    if (onboardingDone !== undefined) update.onboardingDone = Boolean(onboardingDone);

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: safeUserResponse(user) });
  } catch (err) {
    logger.error('PUT /auth/profile', { err: err.message });
    res.status(500).json({ error: 'Profile update failed.' });
  }
});

// PUT /auth/password — change password (requires current password)
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Cannot set password for Google accounts here.' });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    logger.error('PUT /auth/password', { err: err.message });
    res.status(500).json({ error: 'Password change failed.' });
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+resetToken +resetTokenExpiry');
    // Always return 200 to prevent user enumeration
    if (!user || !user.passwordHash) {
      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    if (process.env.SMTP_HOST) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      // Fire-and-forget: don't tie the response time to SMTP latency (which would
      // also widen the timing gap between existing and non-existing accounts).
      transporter.sendMail({
        from: `"MyTrade" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Reset your MyTrade password',
        html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      }).catch((mailErr) => logger.error('forgot-password sendMail failed', { err: mailErr.message }));
    } else {
      logger.info(`[DEV] Password reset link: ${resetUrl}`);
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error('POST /auth/forgot-password', { err: err.message });
    res.status(500).json({ error: 'Failed to send reset email.' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetToken: hashed,
      resetTokenExpiry: { $gt: new Date() },
    }).select('+resetToken +resetTokenExpiry');

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    logger.error('POST /auth/reset-password', { err: err.message });
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

const googleAvailable = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// GET /auth/google
router.get('/google', (req, res, next) => {
  if (!googleAvailable()) {
    return res.status(503).json({ error: 'Google Sign-In is not configured on this server.' });
  }
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })(req, res, next);
});

// GET /auth/google/callback
router.get('/google/callback',
  (req, res, next) => {
    if (!googleAvailable()) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      return res.redirect(`${clientUrl}/login?error=google`);
    }
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=google' })(req, res, next);
  },
  (req, res) => {
    try {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      if (req.user?.isSuspended) {
        return res.redirect(`${clientUrl}/login?error=suspended`);
      }
      // Deliver only the httpOnly refresh cookie; do NOT put the access token in
      // the URL (it would leak via history, logs and Referer). The SPA exchanges
      // the cookie for an access token via /auth/refresh on the callback page.
      const { refreshToken } = issueTokens(req.user);
      setRefreshCookie(res, refreshToken);
      res.redirect(`${clientUrl}/auth/callback`);
    } catch (err) {
      logger.error('GET /auth/google/callback', { err: err.message, userId: req.user?.id });
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${clientUrl}/login?error=google`);
    }
  }
);

// DELETE /auth/account
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { Stock } = require('../db');
    const PushSubscription = require('../models/PushSubscription');
    const AnalyticsEvent = require('../models/AnalyticsEvent');
    const WatchlistItem = require('../models/WatchlistItem');
    const user = await User.findById(req.user.id);
    const watchlist = user?.watchlist || [];

    await User.findByIdAndDelete(req.user.id);

    // Remove Stock documents for tickers no longer tracked by anyone
    if (watchlist.length > 0) {
      for (const ticker of watchlist) {
        const remaining = await User.countDocuments({ watchlist: ticker });
        if (remaining === 0) await Stock.deleteOne({ ticker });
      }
    }

    // Clean up the user's personal data so nothing is left orphaned. AuditLog is
    // intentionally retained as a security/compliance trail (not user content).
    await Promise.allSettled([
      PushSubscription.deleteMany({ userId: req.user.id }),
      AnalyticsEvent.deleteMany({ userId: req.user.id }),
      WatchlistItem.deleteMany({ userId: req.user.id }),
    ]);

    res.clearCookie(REFRESH_COOKIE, { path: '/auth/refresh' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('DELETE /auth/account', { err: err.message });
    res.status(500).json({ error: 'Account deletion failed.' });
  }
});

module.exports = router;
