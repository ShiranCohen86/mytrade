import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { identifyUser } from '@/lib/analytics';

const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';
const TOKEN_KEY = 'mytrade-token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  };

  const setToken = (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage unavailable */ }
  };

  const logout = useCallback(async () => {
    try {
      await fetch(`${EXPRESS}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }, []);

  // Verify token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setIsLoading(false); return; }

    fetch(`${EXPRESS}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ user: u }) => setUser(u))
      .catch(() => {
        // Try refresh token flow
        return fetch(`${EXPRESS}/auth/refresh`, { method: 'POST', credentials: 'include' })
          .then((r) => r.ok ? r.json() : Promise.reject())
          .then(({ accessToken }) => {
            setToken(accessToken);
            return fetch(`${EXPRESS}/auth/me`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          })
          .then((r) => r.ok ? r.json() : Promise.reject())
          .then(({ user: u }) => setUser(u))
          .catch(() => setToken(null));
      })
      .finally(() => setIsLoading(false));
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
