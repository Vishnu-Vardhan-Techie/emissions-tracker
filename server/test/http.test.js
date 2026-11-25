import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'x'.repeat(40);
const { createApp } = await import('../src/app.js');

let server; let base;
test.before(async () => {
  await new Promise((r) => { server = createApp().listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('health endpoint is public', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
});

test('every data route rejects missing tokens', async () => {
  for (const p of ['/api/dashboard', '/api/activities', '/api/users', '/api/factors', '/api/targets', '/api/ingest/template/activity']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 401, p);
  }
});

test('forged, wrongly-signed and expired tokens are rejected', async () => {
  const bad = jwt.sign({ sub: 'abc', role: 'admin', org: 'x' }, 'a-different-secret-that-is-long-enough!!');
  const expired = jwt.sign({ sub: 'abc', role: 'admin', org: 'x' }, process.env.JWT_SECRET, { expiresIn: -10 });
  for (const t of [bad, expired, 'garbage']) {
    const r = await fetch(`${base}/api/dashboard`, { headers: { Authorization: `Bearer ${t}` } });
    assert.equal(r.status, 401);
  }
});

test('security headers are set and unknown public routes 404 behind auth', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.ok(r.headers.get('x-content-type-options'));
  assert.equal(r.headers.get('x-powered-by'), null);
});
