import { Router } from 'express';
import { Activity, Target } from '../models/index.js';
import { targetProgress, elapsedFraction } from '../services/targets.js';

const router = Router();

const yearRange = (y) => ({ $gte: new Date(Date.UTC(y, 0, 1)), $lt: new Date(Date.UTC(y + 1, 0, 1)) });
const r2 = (n) => Math.round(n * 100) / 100;

// For the in-progress year, compare against the same elapsed period of the previous year.
function sameDayLastYear(year, now = new Date()) {
  if (year !== now.getUTCFullYear()) return undefined;
  return new Date(Date.UTC(year - 1, now.getUTCMonth(), now.getUTCDate() + 1));
}

async function yearTotal(org, year, cutoff) {
  const range = yearRange(year);
  if (cutoff) range.$lt = cutoff;
  const [row] = await Activity.aggregate([
    { $match: { org, date: range } },
    { $group: { _id: null, kg: { $sum: '$kgCo2e' } } },
  ]);
  return row?.kg || 0;
}

router.get('/', async (req, res) => {
  const org = req.user.org;
  const year = parseInt(req.query.year) || new Date().getUTCFullYear();
  const match = { org, date: yearRange(year) };

  const [byCategory, byScope, monthly, yearly, targets, prevKg] = await Promise.all([
    Activity.aggregate([
      { $match: match },
      { $group: { _id: '$category', kg: { $sum: '$kgCo2e' }, count: { $sum: 1 } } },
      { $sort: { kg: -1 } },
    ]),
    Activity.aggregate([{ $match: match }, { $group: { _id: '$scope', kg: { $sum: '$kgCo2e' } } }, { $sort: { _id: 1 } }]),
    Activity.aggregate([
      { $match: match },
      { $group: { _id: { $month: '$date' }, kg: { $sum: '$kgCo2e' } } },
    ]),
    Activity.aggregate([
      { $match: { org } },
      { $group: { _id: { $year: '$date' }, kg: { $sum: '$kgCo2e' } } },
      { $sort: { _id: 1 } },
    ]),
    Target.find({ org }).sort({ targetYear: 1 }).lean(),
    yearTotal(org, year - 1, sameDayLastYear(year)),
  ]);

  const totalKg = byCategory.reduce((s, c) => s + c.kg, 0);
  const monthMap = new Map(monthly.map((m) => [m._id, m.kg]));

  const frac = elapsedFraction(year);
  const targetsOut = [];
  for (const t of targets) {
    const baselineKg = t.baselineKgOverride ?? (await yearTotal(org, t.baselineYear));
    targetsOut.push({ id: t._id, name: t.name, baselineYear: t.baselineYear, targetYear: t.targetYear, reductionPct: t.reductionPct, baselineSource: t.baselineKgOverride != null ? 'manual' : 'recorded', ...targetProgress(t, baselineKg, year, totalKg, frac) });
  }

  res.json({
    year,
    availableYears: yearly.map((y) => y._id),
    totalKg: r2(totalKg),
    totalTonnes: r2(totalKg / 1000),
    previousYearKg: r2(prevKg),
    changeBasis: sameDayLastYear(year) ? 'same period' : 'full year',
    changeVsPreviousPct: prevKg > 0 ? r2(((totalKg - prevKg) / prevKg) * 100) : null,
    byCategory: byCategory.map((c) => ({ category: c._id, kg: r2(c.kg), count: c.count, pct: totalKg ? r2((c.kg / totalKg) * 100) : 0 })),
    byScope: [1, 2, 3].map((s) => ({ scope: s, kg: r2(byScope.find((x) => x._id === s)?.kg || 0) })),
    monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, kg: r2(monthMap.get(i + 1) || 0) })),
    yearly: yearly.map((y) => ({ year: y._id, kg: r2(y.kg) })),
    targets: targetsOut.map((t) => ({
      ...t,
      baselineKg: r2(t.baselineKg), targetKg: r2(t.targetKg), allowedKg: r2(t.allowedKg), currentKg: r2(t.currentKg),
      projectedKg: r2(t.projectedKg), reductionAchievedPct: r2(t.reductionAchievedPct),
      pathway: t.pathway.map((p) => ({ year: p.year, allowedKg: r2(p.allowedKg) })),
    })),
  });
});

export default router;
