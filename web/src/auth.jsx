import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('et-logout', onLogout);
    if (!getToken()) setReady(true);
    else api('/auth/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
    return () => window.removeEventListener('et-logout', onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(r.token);
    setUser(r.user);
  }, []);
  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  // UI gating only; the API enforces the same rules server-side.
  const can = (action) => {
    const r = user?.role;
    if (action === 'write') return r === 'admin' || r === 'analyst';
    if (action === 'admin') return r === 'admin';
    return !!r;
  };

  return <Ctx.Provider value={{ user, ready, login, logout, can }}>{children}</Ctx.Provider>;
}
