import { getAccessToken, setAccessToken } from './authToken';

const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Single-flight refresh: if several requests 401 at once, they share one
// /auth/refresh call instead of each rotating the refresh cookie (which races).
let refreshPromise = null;
function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${EXPRESS}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('refresh failed'))))
      .then(({ accessToken }) => {
        setAccessToken(accessToken);
        return accessToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (res.status === 401) {
    // Refresh the access token (single-flight) and retry the original request once.
    try {
      const accessToken = await refreshAccessToken();
      const retry = await fetch(path, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...options.headers,
        },
        credentials: 'include',
        ...options,
      });
      if (retry.ok) {
        if (retry.status === 204) return undefined;
        return retry.json();
      }
    } catch { /* fall through to redirect */ }

    setAccessToken(null);
    window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined;

  const ct = res.headers.get('content-type');
  if (!ct?.includes('application/json')) {
    throw new Error(`Unexpected response type from ${path}: ${ct ?? 'none'}`);
  }

  return res.json();
}

async function requestWithRetry(path, options) {
  try {
    return await request(path, options);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err.message.startsWith('Request failed:')) throw err;
    if (err.message.startsWith('Unexpected response type')) throw err;
    if (err.message.includes('Session expired')) throw err;
    if (options?.method && options.method !== 'GET') throw err;
    await new Promise((r) => setTimeout(r, 500));
    return request(path, options);
  }
}

export const checkHealth = () =>
  request(`${EXPRESS}/health`);

export const getStocks = () =>
  requestWithRetry(`${EXPRESS}/api/stocks`);

export const getQuotes = (signal) =>
  request(`${EXPRESS}/api/quotes`, { signal });

export const getQuote = (ticker, signal) =>
  request(`${EXPRESS}/api/stocks/${ticker}/quote`, { signal });

export const addStock = (ticker) =>
  request(`${EXPRESS}/api/stocks`, {
    method: 'POST',
    body: JSON.stringify({ ticker }),
  });

export const removeStock = (ticker) =>
  request(`${EXPRESS}/api/stocks/${ticker}`, { method: 'DELETE' });

export const getAnalysis = (ticker, signal) =>
  requestWithRetry(`${EXPRESS}/api/stocks/${ticker}/analysis`, { signal });

export const refreshStock = (ticker, signal) =>
  request(`${EXPRESS}/api/refresh/${ticker}`, { method: 'POST', signal });

export const getNews = (ticker, signal) =>
  requestWithRetry(`${EXPRESS}/api/news/${ticker}`, { signal });

export const getPortfolio = () =>
  requestWithRetry(`${EXPRESS}/api/portfolio`);
export const setEntryPrice = (ticker, entryPrice, shares = null) =>
  request(`${EXPRESS}/api/portfolio/${ticker}`, { method: 'PUT', body: JSON.stringify({ entryPrice, shares }) });
export const clearEntryPrice = (ticker) =>
  request(`${EXPRESS}/api/portfolio/${ticker}`, { method: 'DELETE' });

export const getAlerts = () =>
  requestWithRetry(`${EXPRESS}/api/alerts`);
export const setAlert = (ticker, targetPrice, direction) =>
  request(`${EXPRESS}/api/alerts/${ticker}`, { method: 'PUT', body: JSON.stringify({ targetPrice, direction }) });
export const clearAlert = (ticker) =>
  request(`${EXPRESS}/api/alerts/${ticker}`, { method: 'DELETE' });

export const reorderWatchlist = (order) =>
  request(`${EXPRESS}/api/watchlist/order`, { method: 'PUT', body: JSON.stringify({ order }) });

export const getNotes = () =>
  requestWithRetry(`${EXPRESS}/api/notes`);
export const saveNote = (ticker, text) =>
  request(`${EXPRESS}/api/notes/${ticker}`, { method: 'PUT', body: JSON.stringify({ text }) });
export const deleteNote = (ticker) =>
  request(`${EXPRESS}/api/notes/${ticker}`, { method: 'DELETE' });

export const getMarketOverview = () =>
  request(`${EXPRESS}/api/market/overview`);

export const getMarketMovers = () =>
  request(`${EXPRESS}/api/market/movers`);

// Auth endpoints
export const authRegister = (email, password, displayName) =>
  request(`${EXPRESS}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });

export const authLogin = (email, password) =>
  request(`${EXPRESS}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const authForgotPassword = (email) =>
  request(`${EXPRESS}/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const authResetPassword = (token, password) =>
  request(`${EXPRESS}/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });

export const updateProfile = (data) =>
  request(`${EXPRESS}/auth/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const changePassword = (currentPassword, newPassword) =>
  request(`${EXPRESS}/auth/password`, {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });

export const deleteAccount = () =>
  request(`${EXPRESS}/auth/account`, { method: 'DELETE' });

export const searchStocks = (q) =>
  request(`${EXPRESS}/api/search?q=${encodeURIComponent(q)}`);

// ─── Web Push ─────────────────────────────────────────────────────────────────

export const getPushVapidKey = () =>
  request(`${EXPRESS}/api/push/vapid-public-key`);

export const getPushStatus = () =>
  request(`${EXPRESS}/api/push/status`);

export const savePushSubscription = (subscription, platform, categories) =>
  request(`${EXPRESS}/api/push/subscribe`, {
    method: 'POST',
    body: JSON.stringify({ subscription, platform, categories }),
  });

export const removePushSubscription = (endpoint) =>
  request(`${EXPRESS}/api/push/unsubscribe`, {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });

export const updatePushPreferences = (categories) =>
  request(`${EXPRESS}/api/push/preferences`, {
    method: 'PUT',
    body: JSON.stringify({ categories }),
  });

// ─── Admin: Users ─────────────────────────────────────────────────────────────

export const adminGetUsers = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`${EXPRESS}/api/admin/users${qs ? `?${qs}` : ''}`);
};

export const adminGetUser = (id) =>
  request(`${EXPRESS}/api/admin/users/${id}`);

export const adminSetRole = (id, role) =>
  request(`${EXPRESS}/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });

export const adminSuspendUser = (id, suspend, reason = '') =>
  request(`${EXPRESS}/api/admin/users/${id}/suspend`, {
    method: 'PUT',
    body: JSON.stringify({ suspend, reason }),
  });

export const adminDeleteUser = (id) =>
  request(`${EXPRESS}/api/admin/users/${id}`, { method: 'DELETE' });

// ─── Admin: Audit Logs ────────────────────────────────────────────────────────

export const adminGetAuditLogs = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`${EXPRESS}/api/admin/audit${qs ? `?${qs}` : ''}`);
};

export const adminGetAuditStats = (since) =>
  request(`${EXPRESS}/api/admin/audit/stats${since ? `?since=${since}` : ''}`);

export const adminExportAudit = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return `${EXPRESS}/api/admin/audit/export${qs ? `?${qs}` : ''}`;
};

// ─── Admin: Analytics ─────────────────────────────────────────────────────────

export const adminAnalyticsOverview = () =>
  request(`${EXPRESS}/api/admin/analytics/overview`);

export const adminAnalyticsSignups = (days = 30) =>
  request(`${EXPRESS}/api/admin/analytics/signups?days=${days}`);

export const adminAnalyticsActivity = (days = 30) =>
  request(`${EXPRESS}/api/admin/analytics/activity?days=${days}`);

export const adminAnalyticsWatchlists = () =>
  request(`${EXPRESS}/api/admin/analytics/watchlists`);

export const adminAnalyticsSecurity = () =>
  request(`${EXPRESS}/api/admin/analytics/security`);

export const adminAnalyticsProduct = (days = 30) =>
  request(`${EXPRESS}/api/admin/analytics/product?days=${days}`);

// ─── Admin: Watchlists ────────────────────────────────────────────────────────

export const adminGetWatchlists = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`${EXPRESS}/api/admin/watchlists${qs ? `?${qs}` : ''}`);
};

export const adminGetUserWatchlist = (userId) =>
  request(`${EXPRESS}/api/admin/watchlists/${userId}`);

export const adminRestoreWatchlistItem = (userId, symbol) =>
  request(`${EXPRESS}/api/admin/watchlists/${userId}/restore/${symbol}`, { method: 'POST' });

export const adminDisableWatchlistItem = (userId, symbol, reason = '') =>
  request(`${EXPRESS}/api/admin/watchlists/${userId}/disable/${symbol}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// ─── Admin: Support ───────────────────────────────────────────────────────────

export const adminImpersonate = (userId) =>
  request(`${EXPRESS}/api/admin/support/impersonate/${userId}`, { method: 'POST' });

export const adminGetUserActivity = (userId, limit = 100) =>
  request(`${EXPRESS}/api/admin/support/users/${userId}/activity?limit=${limit}`);

export const adminFlagUser = (userId, reason, severity = 'warning') =>
  request(`${EXPRESS}/api/admin/support/users/${userId}/flag`, {
    method: 'POST',
    body: JSON.stringify({ reason, severity }),
  });

export const adminSearch = (q) =>
  request(`${EXPRESS}/api/admin/support/search?q=${encodeURIComponent(q)}`);

// ─── Admin: User Insights ─────────────────────────────────────────────────────

export const adminGetUserInsights = (userId, days = 30) =>
  request(`${EXPRESS}/api/admin/users/${userId}/insights?days=${days}`);

// ─── User: Personal Timeline ──────────────────────────────────────────────────

export const getTimeline = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return requestWithRetry(`${EXPRESS}/api/timeline${qs ? `?${qs}` : ''}`);
};

export const getTimelineInsights = (days = 30) =>
  requestWithRetry(`${EXPRESS}/api/timeline/insights?days=${days}`);

// ─── Admin: AI Market Intelligence (admin / super_admin only) ─────────────────

export const adminIntelligenceOverview = () =>
  request(`${EXPRESS}/api/admin/intelligence/overview`);

export const adminIntelligenceHotStocks = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`${EXPRESS}/api/admin/intelligence/hot-stocks${qs ? `?${qs}` : ''}`);
};

export const adminIntelligenceHotStockDetail = (symbol) =>
  request(`${EXPRESS}/api/admin/intelligence/hot-stocks/${encodeURIComponent(symbol)}`);

export const adminIntelligenceSectorHeatmap = () =>
  request(`${EXPRESS}/api/admin/intelligence/sector-heatmap`);

export const adminIntelligenceRefresh = () =>
  request(`${EXPRESS}/api/admin/intelligence/refresh`, { method: 'POST' });

export const adminIntelligenceExportUrl = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return `${EXPRESS}/api/admin/intelligence/export${qs ? `?${qs}` : ''}`;
};

// ─── In-app notifications (recipient — any authenticated user) ────────────────

const notifQs = (params = {}) =>
  new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();

export const getNotifications = (params = {}) => {
  const qs = notifQs(params);
  return request(`${EXPRESS}/api/notifications${qs ? `?${qs}` : ''}`);
};
export const getNotificationUnreadCount = () => request(`${EXPRESS}/api/notifications/unread-count`);
export const markNotificationRead = (id) => request(`${EXPRESS}/api/notifications/${id}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => request(`${EXPRESS}/api/notifications/read-all`, { method: 'POST' });
export const deleteNotification = (id) => request(`${EXPRESS}/api/notifications/${id}`, { method: 'DELETE' });
export const clickNotification = (id) => request(`${EXPRESS}/api/notifications/${id}/click`, { method: 'POST' });
export const markNotificationsSeen = (ids) =>
  request(`${EXPRESS}/api/notifications/seen`, { method: 'POST', body: JSON.stringify({ ids }) });

// ─── Admin: Notification console (notifications.read / notifications.send) ─────

export const adminListCampaigns = (params = {}) => {
  const qs = notifQs(params);
  return request(`${EXPRESS}/api/admin/notifications${qs ? `?${qs}` : ''}`);
};
export const adminGetCampaign = (id) => request(`${EXPRESS}/api/admin/notifications/${id}`);
export const adminCreateCampaign = (dto) =>
  request(`${EXPRESS}/api/admin/notifications`, { method: 'POST', body: JSON.stringify(dto) });
export const adminUpdateCampaign = (id, dto) =>
  request(`${EXPRESS}/api/admin/notifications/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const adminSendCampaign = (id) =>
  request(`${EXPRESS}/api/admin/notifications/${id}/send`, { method: 'POST' });
export const adminCancelCampaign = (id) =>
  request(`${EXPRESS}/api/admin/notifications/${id}/cancel`, { method: 'POST' });
export const adminPreviewRecipients = (audience) =>
  request(`${EXPRESS}/api/admin/notifications/preview-count`, { method: 'POST', body: JSON.stringify({ audience }) });
export const adminCampaignDeliveries = (id, params = {}) => {
  const qs = notifQs(params);
  return request(`${EXPRESS}/api/admin/notifications/${id}/deliveries${qs ? `?${qs}` : ''}`);
};
export const adminNotificationAnalytics = (days = 30) =>
  request(`${EXPRESS}/api/admin/notifications/analytics?days=${days}`);

export const adminListTemplates = (status) =>
  request(`${EXPRESS}/api/admin/notification-templates${status ? `?status=${status}` : ''}`);
export const adminCreateTemplate = (dto) =>
  request(`${EXPRESS}/api/admin/notification-templates`, { method: 'POST', body: JSON.stringify(dto) });
export const adminUpdateTemplate = (id, dto) =>
  request(`${EXPRESS}/api/admin/notification-templates/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const adminDuplicateTemplate = (id) =>
  request(`${EXPRESS}/api/admin/notification-templates/${id}/duplicate`, { method: 'POST' });
export const adminArchiveTemplate = (id, archived = true) =>
  request(`${EXPRESS}/api/admin/notification-templates/${id}/archive`, { method: 'POST', body: JSON.stringify({ archived }) });

// ─── Admin: Automation engine (notifications.read / notifications.send) ───────

export const adminAutomationRegistry = () => request(`${EXPRESS}/api/admin/automations/registry`);
export const adminListAutomations = (params = {}) => {
  const qs = notifQs(params);
  return request(`${EXPRESS}/api/admin/automations${qs ? `?${qs}` : ''}`);
};
export const adminGetAutomation = (id) => request(`${EXPRESS}/api/admin/automations/${id}`);
export const adminCreateAutomation = (dto) =>
  request(`${EXPRESS}/api/admin/automations`, { method: 'POST', body: JSON.stringify(dto) });
export const adminUpdateAutomation = (id, dto) =>
  request(`${EXPRESS}/api/admin/automations/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const adminDeleteAutomation = (id) =>
  request(`${EXPRESS}/api/admin/automations/${id}`, { method: 'DELETE' });
export const adminPauseAutomation = (id) =>
  request(`${EXPRESS}/api/admin/automations/${id}/pause`, { method: 'POST' });
export const adminResumeAutomation = (id) =>
  request(`${EXPRESS}/api/admin/automations/${id}/resume`, { method: 'POST' });
export const adminDuplicateAutomation = (id) =>
  request(`${EXPRESS}/api/admin/automations/${id}/duplicate`, { method: 'POST' });
export const adminTestAutomation = (id) =>
  request(`${EXPRESS}/api/admin/automations/${id}/test`, { method: 'POST' });
export const adminRunAutomation = (id) =>
  request(`${EXPRESS}/api/admin/automations/${id}/run`, { method: 'POST' });
export const adminAutomationLogs = (id, params = {}) => {
  const qs = notifQs(params);
  return request(`${EXPRESS}/api/admin/automations/${id}/logs${qs ? `?${qs}` : ''}`);
};
export const adminAutomationAnalytics = (days = 30) =>
  request(`${EXPRESS}/api/admin/automations/analytics?days=${days}`);

// Socket.io base — '' (same origin) in prod, the Express URL in dev.
export const SOCKET_URL = EXPRESS || undefined;
