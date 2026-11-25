import { parse } from './csvShim.js';
import { calculateEmissions, classifyInvoice, toUsd, currencyRates } from './calculate.js';

const norm = (s) => String(s ?? '').trim();

function parseDate(v) {
  const s = norm(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readRows(buffer) {
  return parse(buffer, {
    columns: (h) => h.map((x) => norm(x).toLowerCase().replace(/\s+/g, '_')),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

/**
 * Activity CSV columns: date, factor_key, quantity, unit (optional), facility (optional), description (optional)
 * @param {Buffer|string} buffer
 * @param {Map<string, object>} factorMap  key -> factor
 */
export function parseActivityCsv(buffer, factorMap) {
  const rows = readRows(buffer);
  const accepted = [];
  const rejected = [];
  rows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    try {
      const date = parseDate(r.date);
      if (!date) throw new Error('invalid or missing date');
      const factor = factorMap.get(norm(r.factor_key));
      if (!factor) throw new Error(`unknown factor_key "${norm(r.factor_key)}"`);
      const quantity = Number(r.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error('invalid quantity');
      const unit = norm(r.unit) || factor.unit;
      const { quantityNative, kgCo2e } = calculateEmissions({ quantity, unit }, factor);
      accepted.push({
        date, factorKey: factor.key, category: factor.category, scope: factor.scope,
        quantity, unit, quantityNative, kgCo2e,
        facility: norm(r.facility), description: norm(r.description), source: 'csv',
      });
    } catch (e) {
      rejected.push({ line, reason: e.message });
    }
  });
  return { accepted, rejected };
}

/**
 * Invoice CSV columns: invoice_no, vendor, date, description, amount, currency (default USD), factor_key (optional)
 * Converted with spend-based factors (kg CO2e per USD).
 */
export function parseInvoiceCsv(buffer, factorMap, rates = currencyRates()) {
  const rows = readRows(buffer);
  const accepted = [];
  const rejected = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    try {
      const date = parseDate(r.date);
      if (!date) throw new Error('invalid or missing date');
      const amount = Number(r.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error('invalid amount');
      const usd = toUsd(amount, norm(r.currency) || 'USD', rates);
      const key = classifyInvoice(`${norm(r.description)} ${norm(r.vendor)}`, norm(r.factor_key) || undefined);
      const factor = factorMap.get(key);
      if (!factor) throw new Error(`unknown factor_key "${key}"`);
      if (factor.unit !== 'USD') throw new Error(`factor "${key}" is not spend-based`);
      const { kgCo2e } = calculateEmissions({ quantity: usd, unit: 'USD' }, factor);
      accepted.push({
        date, factorKey: factor.key, category: factor.category, scope: factor.scope,
        quantity: Math.round(usd * 100) / 100, unit: 'USD', quantityNative: usd, kgCo2e,
        facility: '', description: `${norm(r.vendor)} ${norm(r.invoice_no)} ${norm(r.description)}`.trim(),
        source: 'invoice', externalRef: norm(r.invoice_no) || undefined,
      });
    } catch (e) {
      rejected.push({ line, reason: e.message });
    }
  });
  return { accepted, rejected };
}

export const TEMPLATES = {
  activity: 'date,factor_key,quantity,unit,facility,description\n2025-01-31,electricity.us,12500,kWh,HQ,January grid electricity\n2025-01-31,fuel.diesel,300,litre,Depot,Fleet diesel\n2025-02-10,travel.flight_long,5400,passenger-km,,NYC-LON return\n',
  invoice: 'invoice_no,vendor,date,description,amount,currency,factor_key\nINV-1001,Acme Cloud,2025-01-15,Cloud hosting,2400,USD,\nINV-1002,FastFreight,2025-01-20,Courier shipping,860,EUR,\nINV-1003,Stationers Ltd,2025-02-02,Office paper and toner,310,GBP,\n',
};
