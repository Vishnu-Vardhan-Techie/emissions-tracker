/**
 * Linear reduction pathway from baseline year to target year.
 * @returns pathway emission allowance (kg) for `year`.
 */
export function pathwayKg({ baselineKg, baselineYear, targetYear, reductionPct }, year) {
  const targetKg = baselineKg * (1 - reductionPct / 100);
  if (year <= baselineYear) return baselineKg;
  if (year >= targetYear) return targetKg;
  const t = (year - baselineYear) / (targetYear - baselineYear);
  return baselineKg + (targetKg - baselineKg) * t;
}

/**
 * Progress of `currentKg` (emissions recorded in `year`) against a target.
 * For the in-progress calendar year, pass `elapsedFraction` (0-1) to project a full-year figure.
 */
export function targetProgress(target, baselineKg, year, currentKg, elapsedFraction = 1) {
  const spec = { baselineKg, baselineYear: target.baselineYear, targetYear: target.targetYear, reductionPct: target.reductionPct };
  const targetKg = baselineKg * (1 - target.reductionPct / 100);
  const allowedKg = pathwayKg(spec, year);
  const projectedKg = elapsedFraction > 0 && elapsedFraction < 1 ? currentKg / elapsedFraction : currentKg;
  const reductionAchievedPct = baselineKg > 0 ? ((baselineKg - projectedKg) / baselineKg) * 100 : 0;
  return {
    baselineKg,
    targetKg,
    allowedKg,
    currentKg,
    projectedKg,
    partialYear: elapsedFraction < 1,
    reductionAchievedPct,
    onTrack: baselineKg > 0 ? projectedKg <= allowedKg : true,
    pathway: yearsRange(target.baselineYear, target.targetYear).map((y) => ({ year: y, allowedKg: pathwayKg(spec, y) })),
  };
}

function yearsRange(a, b) {
  const out = [];
  for (let y = a; y <= b; y++) out.push(y);
  return out;
}

/** Fraction of `year` elapsed as of `now` (1 for past years). */
export function elapsedFraction(year, now = new Date()) {
  const y = now.getUTCFullYear();
  if (year < y) return 1;
  if (year > y) return 0;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return (now.getTime() - start) / (end - start);
}
