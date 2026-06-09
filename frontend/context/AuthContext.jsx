import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { identifyUser } from '@/lib/analytics';
import { getAccessToken, setAccessToken } from '@/lib/authToken';

const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Access token is held in memory only (not localStorage) so XSS can't read it.
  const getToken = () => getAccessToken();
  const setToken = (token) => setAccessToken(token);

  const logout = useCallback(async () => {
    try {
      const token = getToken();
      await fetch(`${EXPRESS}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        // Send the token so the server can bump tokenVersion (revoke refresh tokens).
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    // Purge cached authenticated API responses so personal data (watchlist,
    // portfolio, …) isn't readable after sign-out on a shared device / offline.
    try {
      if (typeof caches !== 'undefined') await caches.delete('api-cache');
    } catch { /* ignore */ }
  }, []);

  // Rehydrate the session on mount. The access token lives only in memory, so on
  // a fresh load there's nothing persisted to read — exchange the httpOnly refresh
  // cookie for a fresh access token, then load the user.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${EXPRESS}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!r.ok) throw new Error('no session');
        const { accessToken } = await r.json();
        setToken(accessToken);
        const meRes = await fetch(`${EXPRESS}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!meRes.ok) throw new Error('me failed');
        const { user: u } = await meRes.json();
        setUser(u);
      } catch {
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${EXPRESS}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, displayName) => {
    const res = await fetch(`${EXPRESS}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  // Attach the user id to analytics events once known.
  useEffect(() => {
    identifyUser(user ? (user.id || user._id) : null);
  }, [user]);

  const updateUser = (partial) => setUser((u) => u ? { ...u, ...partial } : u);

  const loginWithToken = useCallback(async (token) => {
    setToken(token);
    try {
      const res = await fetch(`${EXPRESS}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch { /* silent */ }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      updateUser,
      loginWithToken,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
