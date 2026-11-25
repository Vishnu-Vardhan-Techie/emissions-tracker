import { UNIT_CONVERSIONS, DEFAULT_RATES, INVOICE_KEYWORDS } from './factors.js';

/** Convert quantity from `fromUnit` into the factor's native unit. */
export function convertQuantity(quantity, fromUnit, toUnit) {
  if (!Number.isFinite(quantity)) throw new Error('quantity must be a number');
  if (!fromUnit || fromUnit.toLowerCase() === toUnit.toLowerCase()) return quantity;
  const key = `${fromUnit.toLowerCase()}->${toUnit}`;
  const mult = UNIT_CONVERSIONS[key];
  if (mult === undefined) throw new Error(`cannot convert unit "${fromUnit}" to "${toUnit}"`);
  return quantity * mult;
}

/**
 * Calculate emissions for one activity.
 * @param {{quantity:number, unit?:string}} activity
 * @param {{factor:number, unit:string, key:string}} factor
 * @returns {{quantityNative:number, kgCo2e:number}}
 */
export function calculateEmissions(activity, factor) {
  const q = Number(activity.quantity);
  if (!(q >= 0)) throw new Error('quantity must be a non-negative number');
  const quantityNative = convertQuantity(q, activity.unit, factor.unit);
  return { quantityNative, kgCo2e: round(quantityNative * factor.factor, 4) };
}

export function currencyRates(env = process.env) {
  if (!env.CURRENCY_RATES) return DEFAULT_RATES;
  try {
    return { ...DEFAULT_RATES, ...JSON.parse(env.CURRENCY_RATES) };
  } catch {
    return DEFAULT_RATES;
  }
}

export function toUsd(amount, currency = 'USD', rates = currencyRates()) {
  const rate = rates[String(currency).toUpperCase()];
  if (rate === undefined) throw new Error(`unsupported currency "${currency}"`);
  return amount * rate;
}

/** Pick a spend factor key for an invoice line. */
export function classifyInvoice(description = '', explicitKey) {
  if (explicitKey) return explicitKey;
  for (const { re, key } of INVOICE_KEYWORDS) if (re.test(description)) return key;
  return 'spend.general';
}

export function round(n, dp = 2) {
  const m = 10 ** dp;
  return Math.round(n * m) / m;
}
