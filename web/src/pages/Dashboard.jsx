import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmtKg } from '../api.js';

// Color follows the entity (category), never its rank. Fixed order from the reference palette.
const CATEGORY_COLORS = {
  Electricity: '#257de0',
  'Stationary Fuel': '#f47230',
  'Fleet & Fuel': '#00b894',
  Refrigerants: '#f2a600',
  'Business Travel': '#ee7fac',
  'Waste & Water': '#008a17',
  'Purchased Goods & Services': '#6a4ce2',
};
const FALLBACK = '#7a7a7a';
const ACTUAL = '#257de0';
const PATHWAY = '#f47230';
const GRID = '#e6e6e6';
const AXIS = '#666666';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const tonnes = (kg) => Math.round((kg / 1000) * 10) / 10;

function Tip({ active, payload, label, unit = 't CO₂e' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="tip-title">{label ?? payload[0].payload.category}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tip-row">
          <span className="swatch" style={{ background: p.color || p.payload.fill }} />
          <span>{p.name}</span>
          <strong>{Number(p.value).toLocaleString()} {unit}</strong>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="card kpi">
      <div className="muted small">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}

function TargetCard({ t, yearly, year }) {
  const actualByYear = new Map(yearly.map((y) => [y.year, y.kg]));
  const data = t.pathway.map((p) => ({
    year: p.year,
    pathway: tonnes(p.allowedKg),
    // For the in-progress year, plot the full-year projection rather than the year-to-date total.
    actual: p.year === year && t.partialYear ? tonnes(t.projectedKg) : actualByYear.has(p.year) ? tonnes(actualByYear.get(p.year)) : null,
  }));
  return (
    <div className="card">
      <div className="row between">
        <h3>{t.name}</h3>
        <span className={`badge ${t.onTrack ? 'good' : 'bad'}`}>{t.onTrack ? '✓ On track' : '▲ Behind pathway'}</span>
      </div>
      <p className="muted small">
        −{t.reductionPct}% vs {t.baselineYear} baseline ({fmtKg(t.baselineKg)}, {t.baselineSource}) by {t.targetYear} → target {fmtKg(t.targetKg)}
      </p>
      <div className="row stats">
        <div><div className="muted small">Allowed this year</div><strong>{fmtKg(t.allowedKg)}</strong></div>
        <div><div className="muted small">{t.partialYear ? 'Projected (full year)' : 'Actual'}</div><strong>{fmtKg(t.projectedKg)}</strong></div>
        <div><div className="muted small">Reduction achieved</div><strong>{t.reductionAchievedPct.toFixed(1)}%</strong></div>
      </div>
      <div className="chart" style={{ height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} />
            <YAxis tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={48} unit=" t" />
            <Tooltip content={<Tip />} />
            <Legend verticalAlign="top" height={28} iconType="plainline" />
            <Line isAnimationActive={false} name="Target pathway" dataKey="pathway" stroke={PATHWAY} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: PATHWAY }} />
            <Line isAnimationActive={false} name="Actual" dataKey="actual" stroke={ACTUAL} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: ACTUAL }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [table, setTable] = useState(false);

  useEffect(() => {
    setError('');
    api(`/dashboard?year=${year}`).then(setD).catch((e) => setError(e.message));
  }, [year]);

  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">Loading…</p>;

  const years = Array.from(new Set([...d.availableYears, new Date().getFullYear(), year])).sort((a, b) => b - a);
  const cats = d.byCategory.map((c) => ({ ...c, t: tonnes(c.kg), fill: CATEGORY_COLORS[c.category] || FALLBACK }));
  const monthly = d.monthly.map((m) => ({ month: MONTHS[m.month - 1], t: tonnes(m.kg) }));
  const scopeNames = { 1: 'Scope 1 · direct', 2: 'Scope 2 · energy', 3: 'Scope 3 · value chain' };
  const change = d.changeVsPreviousPct;

  return (
    <div>
      <div className="row between">
        <h1>Dashboard</h1>
        <label className="inline">Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <div className="grid kpis">
        <Kpi label={`Total emissions ${d.year}`} value={`${d.totalTonnes.toLocaleString()} t CO₂e`}
          sub={change === null ? 'No prior-year data' : `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}% vs ${d.changeBasis === 'same period' ? `same period ${d.year - 1}` : d.year - 1}`} />
        {d.byScope.map((s) => (
          <Kpi key={s.scope} label={scopeNames[s.scope]} value={fmtKg(s.kg)}
            sub={d.totalKg ? `${Math.round((s.kg / d.totalKg) * 100)}% of total` : '—'} />
        ))}
      </div>

      {d.totalKg === 0 ? (
        <div className="card"><p>No emissions recorded for {d.year}. Add activities or upload a CSV to get started.</p></div>
      ) : (
        <div className="grid two">
          <div className="card">
            <div className="row between">
              <h3>By category</h3>
              <button className="link" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>
            </div>
            {table ? (
              <table className="tbl">
                <thead><tr><th>Category</th><th className="num">t CO₂e</th><th className="num">Share</th></tr></thead>
                <tbody>{cats.map((c) => <tr key={c.category}><td>{c.category}</td><td className="num">{c.t.toLocaleString()}</td><td className="num">{c.pct}%</td></tr>)}</tbody>
              </table>
            ) : (
              <div className="chart" style={{ height: 40 + cats.length * 44 }}>
                <ResponsiveContainer>
                  <BarChart data={cats} layout="vertical" margin={{ top: 0, right: 96, bottom: 0, left: 8 }} barCategoryGap={10}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="category" width={150} tick={{ fill: '#191919', fontSize: 13 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar isAnimationActive={false} dataKey="t" name="Emissions" radius={[0, 4, 4, 0]} barSize={20}>
                      {cats.map((c) => <Cell key={c.category} fill={c.fill} />)}
                      <LabelList dataKey="t" content={({ x, y, width, height, value }) => (
                        <text x={x + width + 6} y={y + height / 2} dy="0.35em" fill="#191919" fontSize={12}>{`${Number(value).toLocaleString()} t`}</text>
                      )} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Monthly emissions</h3>
            <div className="chart" style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={44} unit=" t" />
                  <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar isAnimationActive={false} dataKey="t" name="Emissions" fill={ACTUAL} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <h2>Reduction targets</h2>
      {d.targets.length === 0 ? (
        <div className="card"><p className="muted">No targets yet. An admin can set one under Targets.</p></div>
      ) : (
        <div className="grid two">{d.targets.map((t) => <TargetCard key={t.id} t={t} yearly={d.yearly} year={d.year} />)}</div>
      )}
    </div>
  );
}
