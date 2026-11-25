// In-browser stand-in for the Express API, used only when built with VITE_DEMO=true.
// Reuses the same emission engine as the server; data lives in memory for the session.
import { FACTORS, DEFAULT_RATES } from './engine/factors.js';
import { calculateEmissions } from './engine/calculate.js';
import { parseActivityCsv, parseInvoiceCsv, TEMPLATES } from './engine/csv.js';
import { targetProgress, elapsedFraction } from './engine/targets.js';

const ORG = 'Northwind Logistics (demo)';
let seq = 1;
const id = () => `d${seq++}`;
const factors = FACTORS.map((f) => ({ ...f }));
const fmap = () => new Map(factors.map((f) => [f.key, f]));

const users = [
  { id: 'u1', name: 'Alex Admin', email: 'admin@demo.io', role: 'admin', active: true, createdAt: new Date().toISOString() },
  { id: 'u2', name: 'Priya Analyst', email: 'analyst@demo.io', role: 'analyst', active: true, createdAt: new Date().toISOString() },
  { id: 'u3', name: 'Victor Viewer', email: 'viewer@demo.io', role: 'viewer', active: true, createdAt: new Date().toISOString() },
];
const activities = [];
const targets = [];

function addActivity(date, key, quantity, facility, description, source = 'manual') {
  const f = fmap().get(key);
  const { quantityNative, kgCo2e } = calculateEmissions({ quantity, unit: f.unit }, f);
  activities.push({ _id: id(), org: ORG, date: date.toISOString(), factorKey: key, category: f.category, scope: f.scope, quantity, unit: f.unit, quantityNative, kgCo2e, facility, description, source });
}

(function seed() {
  const now = new Date();
  const y = now.getUTCFullYear();
  for (const year of [y - 1, y]) {
    const decline = year === y ? 0.9 : 1;
    const last = year === y ? now.getUTCMonth() : 11;
    for (let m = 0; m <= last; m++) {
      const d = new Date(Math.min(Date.UTC(year, m, 15), now.getTime())); // never future-dated
      const season = 1 + 0.22 * Math.cos((m / 12) * 2 * Math.PI);
      addActivity(d, 'electricity.us', Math.round(42000 * season * decline), 'Chicago hub', 'Warehouse electricity');
      addActivity(d, 'fuel.natural_gas', Math.round(18000 * season * decline), 'Chicago hub', 'Heating');
      addActivity(d, 'fuel.diesel', Math.round(5200 * decline), 'Fleet depot', 'Delivery fleet diesel');
      addActivity(d, 'travel.flight_long', Math.round((4000 + (m % 4) * 2500) * decline), '', 'Staff flights');
      addActivity(d, 'travel.rail', 1500, '', 'Staff rail');
      addActivity(d, 'waste.landfill', Math.round(1800 * decline), 'Chicago hub', 'General waste');
      addActivity(d, 'spend.it', Math.round(9000 * decline), '', 'IT purchases', 'invoice');
      addActivity(d, 'spend.logistics', Math.round(14000 * decline), '', 'Third-party freight', 'invoice');
    }
  }
  targets.push({ _id: id(), org: ORG, name: 'Cut emissions 42% by 2030', baselineYear: y - 1, targetYear: 2030, reductionPct: 42 });
})();

const err = (m, status = 400) => Object.assign(new Error(m), { status });
const r2 = (n) => Math.round(n * 100) / 100;
const yr = (a) => new Date(a.date).getUTCFullYear();
const sum = (xs) => xs.reduce((s, a) => s + a.kgCo2e, 0);

function dashboard(year) {
  const inYear = activities.filter((a) => yr(a) === year);
  const total = sum(inYear);
  const group = (keyFn) => { const m = new Map(); for (const a of inYear) { const k = keyFn(a); const e = m.get(k) || { kg: 0, count: 0 }; e.kg += a.kgCo2e; e.count++; m.set(k, e); } return m; };
  const cats = [...group((a) => a.category)].map(([category, v]) => ({ category, kg: r2(v.kg), count: v.count, pct: total ? r2((v.kg / total) * 100) : 0 })).sort((a, b) => b.kg - a.kg);
  const scopes = group((a) => a.scope);
  const months = group((a) => new Date(a.date).getUTCMonth() + 1);
  const yearsSet = [...new Set(activities.map(yr))].sort();
  const yearly = yearsSet.map((y) => ({ year: y, kg: r2(sum(activities.filter((a) => yr(a) === y))) }));
  const now = new Date();
  const cutoff = year === now.getUTCFullYear() ? Date.UTC(year - 1, now.getUTCMonth(), now.getUTCDate() + 1) : Infinity;
  const prev = sum(activities.filter((a) => yr(a) === year - 1 && new Date(a.date).getTime() < cutoff));
  const frac = elapsedFraction(year);
  return {
    year, availableYears: yearsSet, totalKg: r2(total), totalTonnes: r2(total / 1000), previousYearKg: r2(prev),
    changeBasis: cutoff === Infinity ? 'full year' : 'same period',
    changeVsPreviousPct: prev > 0 ? r2(((total - prev) / prev) * 100) : null,
    byCategory: cats,
    byScope: [1, 2, 3].map((s) => ({ scope: s, kg: r2(scopes.get(s)?.kg || 0) })),
    monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, kg: r2(months.get(i + 1)?.kg || 0) })),
    yearly,
    targets: targets.map((t) => {
      const baselineKg = t.baselineKgOverride ?? sum(activities.filter((a) => yr(a) === t.baselineYear));
      const p = targetProgress(t, baselineKg, year, total, frac);
      return {
        id: t._id, name: t.name, baselineYear: t.baselineYear, targetYear: t.targetYear, reductionPct: t.reductionPct,
        baselineSource: t.baselineKgOverride != null ? 'manual' : 'recorded', ...p,
        baselineKg: r2(p.baselineKg), targetKg: r2(p.targetKg), allowedKg: r2(p.allowedKg), currentKg: r2(p.currentKg),
        projectedKg: r2(p.projectedKg), reductionAchievedPct: r2(p.reductionAchievedPct),
        pathway: p.pathway.map((x) => ({ year: x.year, allowedKg: r2(x.allowedKg) })),
      };
    }),
  };
}

const delay = () => new Promise((r) => setTimeout(r, 120));

export async function mockApi(path, { method = 'GET', body, form, token } = {}) {
  await delay();
  const [p, qs = ''] = path.split('?');
  const q = new URLSearchParams(qs);
  const seg = p.split('/').filter(Boolean);

  if (seg[0] === 'auth' && seg[1] === 'login') {
    const u = users.find((x) => x.email === String(body.email).toLowerCase().trim());
    if (!u || !u.active || body.password !== 'demo') throw err('Invalid email or password', 401);
    return { token: u.email, user: { id: u.id, name: u.name, email: u.email, role: u.role, org: ORG } };
  }
  const me = users.find((u) => u.email === token && u.active);
  if (!me) throw err('Authentication required', 401);
  const user = { id: me.id, name: me.name, email: me.email, role: me.role, org: ORG };
  const need = (...roles) => { if (!roles.includes(me.role)) throw err('Insufficient permissions', 403); };

  if (seg[0] === 'auth' && seg[1] === 'me') return { user };
  if (seg[0] === 'dashboard') return dashboard(parseInt(q.get('year')) || new Date().getUTCFullYear());

  if (seg[0] === 'activities') {
    if (method === 'GET') {
      const page = Math.max(1, parseInt(q.get('page')) || 1); const limit = Math.min(200, parseInt(q.get('limit')) || 50);
      const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date));
      return { items: sorted.slice((page - 1) * limit, page * limit), total: sorted.length, page, limit };
    }
    if (method === 'POST') {
      need('admin', 'analyst');
      const f = fmap().get(body.factorKey);
      if (!f) throw err(`unknown factorKey "${body.factorKey}"`);
      const d = new Date(body.date); if (Number.isNaN(d.getTime())) throw err('valid date is required');
      const { quantityNative, kgCo2e } = (() => { try { return calculateEmissions({ quantity: Number(body.quantity), unit: body.unit }, f); } catch (e) { throw err(e.message); } })();
      const doc = { _id: id(), org: ORG, date: d.toISOString(), factorKey: f.key, category: f.category, scope: f.scope, quantity: Number(body.quantity), unit: body.unit || f.unit, quantityNative, kgCo2e, facility: body.facility || '', description: body.description || '', source: 'manual' };
      activities.push(doc); return doc;
    }
    if (method === 'DELETE') {
      need('admin', 'analyst');
      const i = activities.findIndex((a) => a._id === seg[1]); if (i < 0) throw err('Activity not found', 404);
      activities.splice(i, 1); return null;
    }
  }

  if (seg[0] === 'ingest') {
    need('admin', 'analyst');
    const type = seg[1];
    if (!['activity', 'invoice'].includes(type)) throw err('Unknown ingestion type', 404);
    const file = form?.get('file'); if (!file) throw err('Attach a CSV file in the "file" field');
    const text = await file.text();
    let out; try { out = type === 'activity' ? parseActivityCsv(text, fmap()) : parseInvoiceCsv(text, fmap(), DEFAULT_RATES); } catch (e) { throw err(`Could not parse CSV: ${e.message}`); }
    const dry = q.get('dryRun') === 'true';
    if (!dry) for (const a of out.accepted) activities.push({ ...a, _id: id(), org: ORG, date: a.date.toISOString() });
    return { dryRun: dry, imported: dry ? 0 : out.accepted.length, validRows: out.accepted.length, rejected: out.rejected, totalKgCo2e: r2(sum(out.accepted)) };
  }

  if (seg[0] === 'factors') {
    if (method === 'GET') return factors;
    need('admin');
    const f = factors.find((x) => x.key === seg[1]); if (!f) throw err('Factor not found', 404);
    const n = Number(body.factor); if (!Number.isFinite(n) || n < 0) throw err('factor must be a non-negative number');
    f.factor = n; if (body.source) f.source = body.source; return f;
  }

  if (seg[0] === 'targets') {
    if (method === 'GET') return [...targets].sort((a, b) => a.targetYear - b.targetYear);
    need('admin');
    if (method === 'POST') {
      const t = { _id: id(), org: ORG, name: String(body.name || '').trim(), baselineYear: Number(body.baselineYear), targetYear: Number(body.targetYear), reductionPct: Number(body.reductionPct) };
      if (!t.name) throw err('name is required');
      if (!(t.reductionPct >= 0 && t.reductionPct <= 100)) throw err('reductionPct must be between 0 and 100');
      if (t.targetYear <= t.baselineYear) throw err('targetYear must be after baselineYear');
      if (body.baselineKgOverride !== undefined && body.baselineKgOverride !== '') t.baselineKgOverride = Number(body.baselineKgOverride);
      targets.push(t); return t;
    }
    if (method === 'DELETE') { const i = targets.findIndex((t) => t._id === seg[1]); if (i < 0) throw err('Target not found', 404); targets.splice(i, 1); return null; }
  }

  if (seg[0] === 'users') {
    need('admin');
    if (method === 'GET') return users;
    if (method === 'POST') {
      if (!body.name || !body.email || !body.password) throw err('name, email and password are required');
      if (users.some((u) => u.email === body.email.toLowerCase())) throw err('Email already in use', 409);
      const u = { id: id(), name: body.name, email: body.email.toLowerCase(), role: body.role || 'viewer', active: true, createdAt: new Date().toISOString() };
      users.push(u); return u;
    }
    if (method === 'PATCH') {
      const u = users.find((x) => x.id === seg[1]); if (!u) throw err('User not found', 404);
      if (u.id === me.id && ((body.role !== undefined && body.role !== 'admin') || body.active === false)) throw err('You cannot demote or deactivate your own account');
      if (body.role) u.role = body.role; if (body.active !== undefined) u.active = !!body.active; return u;
    }
  }
  throw err('Not found', 404);
}

export { TEMPLATES };
