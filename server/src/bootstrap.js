import bcrypt from 'bcryptjs';
import { User, Factor, Activity, Target } from './models/index.js';
import { FACTORS } from './engine/factors.js';
import { calculateEmissions } from './engine/calculate.js';

/** Insert missing factors; never overwrite values an admin has edited. */
export async function ensureFactors() {
  const existing = new Set((await Factor.find({}, 'key').lean()).map((f) => f.key));
  const missing = FACTORS.filter((f) => !existing.has(f.key));
  if (missing.length) await Factor.insertMany(missing);
  return missing.length;
}

/** Create the first admin from env when the user collection is empty. */
export async function ensureAdmin(env = process.env) {
  if (await User.estimatedDocumentCount()) return null;
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ORG_NAME = 'My Organization' } = env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('No users exist and ADMIN_EMAIL / ADMIN_PASSWORD are not set; nobody can log in.');
    return null;
  }
  if (ADMIN_PASSWORD.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  return User.create({
    name: 'Administrator', email: ADMIN_EMAIL, role: 'admin', org: ORG_NAME,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
  });
}

/** Optional demo data (SEED_DEMO=true): two years of activity and a target for the admin's org. */
export async function seedDemo(org) {
  if (await Activity.exists({ org })) return 0;
  const factors = new Map((await Factor.find().lean()).map((f) => [f.key, f]));
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const docs = [];
  const add = (date, key, quantity, facility, description) => {
    const f = factors.get(key);
    const { quantityNative, kgCo2e } = calculateEmissions({ quantity, unit: f.unit }, f);
    docs.push({ org, date, factorKey: key, category: f.category, scope: f.scope, quantity, unit: f.unit, quantityNative, kgCo2e, facility, description, source: 'manual' });
  };
  for (const year of [thisYear - 1, thisYear]) {
    const decline = year === thisYear ? 0.93 : 1;
    const lastMonth = year === thisYear ? now.getUTCMonth() : 11;
    for (let m = 0; m <= lastMonth; m++) {
      const d = new Date(Math.min(Date.UTC(year, m, 15), now.getTime())); // never future-dated
      const season = 1 + 0.2 * Math.cos(((m - 0) / 12) * 2 * Math.PI);
      add(d, 'electricity.us', Math.round(42000 * season * decline), 'HQ', 'Grid electricity');
      add(d, 'fuel.natural_gas', Math.round(18000 * season * decline), 'HQ', 'Heating');
      add(d, 'fuel.diesel', Math.round(900 * decline), 'Depot', 'Fleet diesel');
      add(d, 'travel.flight_long', Math.round((4000 + (m % 4) * 2500) * decline), '', 'Staff flights');
      add(d, 'travel.rail', 1500, '', 'Staff rail');
      add(d, 'waste.landfill', Math.round(1800 * decline), 'HQ', 'General waste');
      add(d, 'spend.it', Math.round(9000 * decline), '', 'IT purchases');
    }
  }
  await Activity.insertMany(docs);
  if (!(await Target.exists({ org }))) {
    await Target.create({ org, name: 'Net-zero pathway (-42% by 2030)', baselineYear: thisYear - 1, targetYear: 2030, reductionPct: 42 });
  }
  return docs.length;
}
