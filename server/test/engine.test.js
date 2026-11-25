import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTORS } from '../src/engine/factors.js';
import { calculateEmissions, convertQuantity, classifyInvoice, toUsd } from '../src/engine/calculate.js';
import { parseActivityCsv, parseInvoiceCsv, TEMPLATES } from '../src/ingest/csv.js';
import { pathwayKg, targetProgress, elapsedFraction } from '../src/services/targets.js';
import { requireRole } from '../src/middleware/auth.js';

const map = new Map(FACTORS.map((f) => [f.key, f]));

test('factor library has unique keys and sane values', () => {
  assert.equal(new Set(FACTORS.map((f) => f.key)).size, FACTORS.length);
  for (const f of FACTORS) {
    assert.ok(f.factor > 0, f.key);
    assert.ok([1, 2, 3].includes(f.scope), f.key);
    assert.ok(f.source && f.year, f.key);
  }
});

test('calculateEmissions multiplies quantity by factor', () => {
  const r = calculateEmissions({ quantity: 1000, unit: 'kWh' }, map.get('electricity.uk'));
  assert.equal(r.kgCo2e, 207);
});

test('unit conversion: MWh to kWh, gallons to litres, miles to km', () => {
  assert.equal(convertQuantity(2, 'MWh', 'kWh'), 2000);
  assert.ok(Math.abs(convertQuantity(10, 'gallon', 'litre') - 37.8541) < 1e-9);
  const r = calculateEmissions({ quantity: 100, unit: 'mile' }, map.get('travel.car'));
  assert.ok(Math.abs(r.kgCo2e - 100 * 1.609344 * 0.17) < 1e-3);
});

test('incompatible units and negative quantities are rejected', () => {
  assert.throws(() => calculateEmissions({ quantity: 5, unit: 'kg' }, map.get('electricity.uk')), /cannot convert/);
  assert.throws(() => calculateEmissions({ quantity: -1, unit: 'kWh' }, map.get('electricity.uk')));
});

test('invoice classification by keyword and currency conversion', () => {
  assert.equal(classifyInvoice('Cloud hosting for March'), 'spend.it');
  assert.equal(classifyInvoice('Courier shipping'), 'spend.logistics');
  assert.equal(classifyInvoice('Something odd'), 'spend.general');
  assert.equal(classifyInvoice('anything', 'spend.food'), 'spend.food');
  assert.equal(toUsd(100, 'usd'), 100);
  assert.throws(() => toUsd(1, 'XYZ'), /unsupported currency/);
});

test('activity CSV: valid rows accepted, bad rows reported with line numbers', () => {
  const csv = [
    'date,factor_key,quantity,unit,facility,description',
    '2025-01-31,electricity.us,1000,kWh,HQ,ok',
    'not-a-date,electricity.us,1,kWh,,',
    '2025-02-01,nope.key,1,kWh,,',
    '2025-02-02,fuel.diesel,-4,litre,,',
    '2025-02-03,fuel.diesel,10,gallon,,converted',
  ].join('\n');
  const { accepted, rejected } = parseActivityCsv(csv, map);
  assert.equal(accepted.length, 2);
  assert.deepEqual(rejected.map((r) => r.line), [3, 4, 5]);
  assert.equal(accepted[0].kgCo2e, 370);
  assert.ok(Math.abs(accepted[1].kgCo2e - 10 * 3.78541 * 2.7) < 1e-2);
});

test('invoice CSV: spend-based emissions with FX', () => {
  const csv = [
    'invoice_no,vendor,date,description,amount,currency,factor_key',
    'A1,Acme,2025-01-15,Cloud hosting,1000,USD,',
    'A2,Fast,2025-01-20,Courier,100,EUR,',
    'A3,X,2025-01-21,Thing,10,ZZZ,',
    'A4,X,2025-01-22,Thing,10,USD,electricity.us',
  ].join('\n');
  const { accepted, rejected } = parseInvoiceCsv(csv, map);
  assert.equal(accepted.length, 2);
  assert.equal(accepted[0].kgCo2e, 300);
  assert.ok(Math.abs(accepted[1].kgCo2e - 100 * 1.08 * 0.9) < 1e-2);
  assert.equal(rejected.length, 2);
});

test('shipped CSV templates parse without rejections', () => {
  assert.equal(parseActivityCsv(TEMPLATES.activity, map).rejected.length, 0);
  assert.equal(parseInvoiceCsv(TEMPLATES.invoice, map).rejected.length, 0);
});

test('target pathway is linear and clamped', () => {
  const t = { baselineKg: 1000, baselineYear: 2024, targetYear: 2030, reductionPct: 50 };
  assert.equal(pathwayKg(t, 2024), 1000);
  assert.equal(pathwayKg(t, 2027), 750);
  assert.equal(pathwayKg(t, 2030), 500);
  assert.equal(pathwayKg(t, 2040), 500);
});

test('target progress: on-track flag and partial-year projection', () => {
  const target = { baselineYear: 2024, targetYear: 2030, reductionPct: 50 };
  const ok = targetProgress(target, 1000, 2027, 700);
  assert.equal(ok.onTrack, true);
  assert.equal(ok.reductionAchievedPct, 30);
  const behind = targetProgress(target, 1000, 2027, 800);
  assert.equal(behind.onTrack, false);
  const partial = targetProgress(target, 1000, 2027, 350, 0.5);
  assert.equal(partial.projectedKg, 700);
  assert.equal(partial.partialYear, true);
  assert.equal(elapsedFraction(2000, new Date('2026-06-01')), 1);
});

test('requireRole blocks other roles and allows listed ones', () => {
  const run = (role) => {
    let status = 200; let nextCalled = false;
    const res = { status(s) { status = s; return this; }, json() { return this; } };
    requireRole('admin', 'analyst')({ user: { role } }, res, () => { nextCalled = true; });
    return { status, nextCalled };
  };
  assert.deepEqual(run('viewer'), { status: 403, nextCalled: false });
  assert.deepEqual(run('analyst'), { status: 200, nextCalled: true });
  assert.deepEqual(run('admin'), { status: 200, nextCalled: true });
});
