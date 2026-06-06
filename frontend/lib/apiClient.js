async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

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
    if (options?.method && options.method !== 'GET') throw err;
    await new Promise((r) => setTimeout(r, 500));
    return request(path, options);
  }
}

// In dev: '' means Vite proxy routes /api/* → http://localhost:5000
// In prod: set VITE_EXPRESS_URL to the deployed Express URL
const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

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
export const setEntryPrice = (ticker, entryPrice) =>
  request(`${EXPRESS}/api/portfolio/${ticker}`, { method: 'PUT', body: JSON.stringify({ entryPrice }) });
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
