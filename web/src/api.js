const TOKEN_KEY = 'et_token';
export const DEMO = import.meta.env.VITE_DEMO === 'true';
// Set VITE_API_BASE (e.g. https://api.example.com/api) when the API is on another origin; default is same-origin /api.
const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

// In-memory copy first: sandboxed frames may not allow browser storage.
let memToken = null;
export const getToken = () => {
  if (memToken) return memToken;
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  memToken = t || null;
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

export async function api(path, { method = 'GET', body, form, raw } = {}) {
  const token = getToken();
  if (DEMO) {
    const { mockApi } = await import('./demo/mock.js');
    try { return await mockApi(path, { method, body, form, token }); } catch (e) {
      if (e.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('et-logout')); }
      throw e;
    }
  }
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('et-logout')); }
  if (raw) return res;
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const fmtKg = (kg) => {
  const n = Number(kg) || 0;
  return Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} t` : `${Math.round(n).toLocaleString()} kg`;
};
