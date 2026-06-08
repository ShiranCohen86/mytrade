const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';
const TOKEN_KEY = 'mytrade-token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    // Try to refresh the access token first
    try {
      const refreshRes = await fetch(`${EXPRESS}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        const { accessToken } = await refreshRes.json();
        localStorage.setItem(TOKEN_KEY, accessToken);
        // Retry original request with new token
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
      }
    } catch { /* fall through to redirect */ }

    localStorage.removeItem(TOKEN_KEY);
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

// ─── Admin: Users ─────────────────────────────────────────────────────────────

export const adminGetUsers = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`${EXPRESS}/admin/users${qs ? `?${qs}` : ''}`);
};

export const adminGetUser = (id) =>
  request(`${EXPRESS}/admin/users/${id}`);

export const adminSetRole = (id, role) =>
  request(`${EXPRESS}/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });

export const adminSuspendUser = (id, suspend, reason = '') =>
  request(`${EXPRESS}/admin/users/${id}/suspend`, {
    method: 'PUT',
    body: JSON.stringify({ suspend, reason }),
  });

export const adminDeleteUser = (id) =>
  request(`${EXPRESS}/admin/users/${id}`, { method: 'DELETE' });

// ─── Admin: Audit Logs ────────────────────────────────────────────────────────

export const adminGetAuditLogs = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`${EXPRESS}/admin/audit${qs ? `?${qs}` : ''}`);
};

export const adminGetAuditStats = (since) =>
  request(`${EXPRESS}/admin/audit/stats${since ? `?since=${since}` : ''}`);

export const adminExportAudit = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return `${EXPRESS}/admin/audit/export${qs ? `?${qs}` : ''}`;
};

// ─── Admin: Analytics ─────────────────────────────────────────────────────────

export const adminAnalyticsOverview = () =>
  request(`${EXPRESS}/admin/analytics/overview`);

export const adminAnalyticsSignups = (days = 30) =>
  request(`${EXPRESS}/admin/analytics/signups?days=${days}`);

export const adminAnalyticsActivity = (days = 30) =>
  request(`${EXPRESS}/admin/analytics/activity?days=${days}`);

export const adminAnalyticsWatchlists = () =>
  request(`${EXPRESS}/admin/analytics/watchlists`);

export const adminAnalyticsSecurity = () =>
  request(`${EXPRESS}/admin/analytics/security`);

// ─── Admin: Watchlists ────────────────────────────────────────────────────────

export const adminGetWatchlists = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return request(`${EXPRESS}/admin/watchlists${qs ? `?${qs}` : ''}`);
};

export const adminGetUserWatchlist = (userId) =>
  request(`${EXPRESS}/admin/watchlists/${userId}`);

export const adminRestoreWatchlistItem = (userId, symbol) =>
  request(`${EXPRESS}/admin/watchlists/${userId}/restore/${symbol}`, { method: 'POST' });

export const adminDisableWatchlistItem = (userId, symbol, reason = '') =>
  request(`${EXPRESS}/admin/watchlists/${userId}/disable/${symbol}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// ─── Admin: Support ───────────────────────────────────────────────────────────

export const adminImpersonate = (userId) =>
  request(`${EXPRESS}/admin/support/impersonate/${userId}`, { method: 'POST' });

export const adminGetUserActivity = (userId, limit = 100) =>
  request(`${EXPRESS}/admin/support/users/${userId}/activity?limit=${limit}`);

export const adminFlagUser = (userId, reason, severity = 'warning') =>
  request(`${EXPRESS}/admin/support/users/${userId}/flag`, {
    method: 'POST',
    body: JSON.stringify({ reason, severity }),
  });

export const adminSearch = (q) =>
  request(`${EXPRESS}/admin/support/search?q=${encodeURIComponent(q)}`);

// ─── Admin: User Insights ─────────────────────────────────────────────────────

export const adminGetUserInsights = (userId, days = 30) =>
  request(`${EXPRESS}/admin/users/${userId}/insights?days=${days}`);

// ─── User: Personal Timeline ──────────────────────────────────────────────────

export const getTimeline = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return requestWithRetry(`${EXPRESS}/api/timeline${qs ? `?${qs}` : ''}`);
};

export const getTimelineInsights = (days = 30) =>
  requestWithRetry(`${EXPRESS}/api/timeline/insights?days=${days}`);
