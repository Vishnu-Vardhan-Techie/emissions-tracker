// End-to-end API test against a real MongoDB.
// Skipped unless MONGO_TEST_URI is set, e.g.
//   MONGO_TEST_URI=mongodb://localhost:27017/emissions_test npm test
// WARNING: drops the target database before running.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const uri = process.env.MONGO_TEST_URI;
const skip = !uri && 'set MONGO_TEST_URI to run';

process.env.JWT_SECRET = 'y'.repeat(40);
let server; let base;
const tokens = {};

async function call(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
const csvForm = (csv) => { const f = new FormData(); f.append('file', new Blob([csv], { type: 'text/csv' }), 'x.csv'); return f; };

test.before(async () => {
  if (skip) return;
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  const { ensureFactors, ensureAdmin } = await import('../src/bootstrap.js');
  const { createApp } = await import('../src/app.js');
  await ensureFactors();
  await ensureAdmin({ ADMIN_EMAIL: 'admin@test.io', ADMIN_PASSWORD: 'password123', ORG_NAME: 'OrgA' });
  await new Promise((r) => { server = createApp().listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { if (skip) return; server.close(); await mongoose.disconnect(); });

test('login, role-based access and tenant isolation', { skip }, async () => {
  const bad = await call('/api/auth/login', { method: 'POST', body: { email: 'admin@test.io', password: 'nope' } });
  assert.equal(bad.status, 401);
  const login = await call('/api/auth/login', { method: 'POST', body: { email: 'admin@test.io', password: 'password123' } });
  assert.equal(login.status, 200);
  tokens.admin = login.json.token;

  for (const role of ['analyst', 'viewer']) {
    const c = await call('/api/users', { method: 'POST', token: tokens.admin, body: { name: role, email: `${role}@test.io`, password: 'password123', role } });
    assert.equal(c.status, 201);
    tokens[role] = (await call('/api/auth/login', { method: 'POST', body: { email: `${role}@test.io`, password: 'password123' } })).json.token;
  }
  assert.equal((await call('/api/users', { token: tokens.viewer })).status, 403);
  assert.equal((await call('/api/users', { token: tokens.analyst })).status, 403);
  const row = { date: '2025-03-01', factorKey: 'electricity.uk', quantity: 1000 };
  assert.equal((await call('/api/activities', { method: 'POST', token: tokens.viewer, body: row })).status, 403);
  const created = await call('/api/activities', { method: 'POST', token: tokens.analyst, body: row });
  assert.equal(created.status, 201);
  assert.equal(created.json.kgCo2e, 207);
  assert.equal((await call('/api/targets', { method: 'POST', token: tokens.analyst, body: { name: 't', baselineYear: 2024, targetYear: 2030, reductionPct: 10 } })).status, 403);
});

test('CSV ingestion, dry run and dashboard aggregation', { skip }, async () => {
  const csv = 'date,factor_key,quantity,unit\n2025-01-10,electricity.uk,1000,kWh\n2025-01-11,bad.key,1,kWh\n';
  const dry = await call('/api/ingest/activity?dryRun=true', { method: 'POST', token: tokens.analyst, form: csvForm(csv) });
  assert.equal(dry.json.imported, 0);
  assert.equal(dry.json.rejected.length, 1);
  const real = await call('/api/ingest/activity', { method: 'POST', token: tokens.analyst, form: csvForm(csv) });
  assert.equal(real.json.imported, 1);
  assert.equal((await call('/api/ingest/activity', { method: 'POST', token: tokens.viewer, form: csvForm(csv) })).status, 403);

  const inv = 'invoice_no,vendor,date,description,amount,currency\nI1,Acme,2025-02-01,Cloud hosting,1000,USD\n';
  assert.equal((await call('/api/ingest/invoice', { method: 'POST', token: tokens.analyst, form: csvForm(inv) })).json.imported, 1);

  const dash = await call('/api/dashboard?year=2025', { token: tokens.viewer });
  assert.equal(dash.status, 200);
  // 207 (March manual) + 207 (Jan CSV) + 300 (invoice, spend.it) = 714
  assert.equal(dash.json.totalKg, 714);
  assert.equal(dash.json.byCategory.length, 2);
  assert.equal(dash.json.monthly.reduce((s, m) => s + m.kg, 0), 714);
});

test('targets compute progress from recorded baseline', { skip }, async () => {
  const t = await call('/api/targets', { method: 'POST', token: tokens.admin, body: { name: 'T', baselineYear: 2025, targetYear: 2030, reductionPct: 50 } });
  assert.equal(t.status, 201);
  const dash = await call('/api/dashboard?year=2025', { token: tokens.admin });
  assert.equal(dash.json.targets[0].baselineKg, 714);
  assert.equal(dash.json.targets[0].targetKg, 357);
});
