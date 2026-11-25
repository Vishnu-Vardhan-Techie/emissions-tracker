import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const blank = { name: '', baselineYear: new Date().getFullYear() - 1, targetYear: 2030, reductionPct: 42, baselineKgOverride: '' };

export default function Targets() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const load = useCallback(() => api('/targets').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api('/targets', { method: 'POST', body: { ...form, baselineKgOverride: form.baselineKgOverride === '' ? undefined : Number(form.baselineKgOverride) } });
      setForm(blank); load();
    } catch (err) { setError(err.message); }
  };
  const remove = async (id) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId(null);
    try { await api(`/targets/${id}`, { method: 'DELETE' }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <h1>Reduction targets</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {can('admin') && (
        <form className="card form-row" onSubmit={add}>
          <label className="grow">Name<input value={form.name} onChange={set('name')} required placeholder="e.g. 42% by 2030" /></label>
          <label>Baseline year<input type="number" value={form.baselineYear} onChange={set('baselineYear')} required /></label>
          <label>Target year<input type="number" value={form.targetYear} onChange={set('targetYear')} required /></label>
          <label>Reduction %<input type="number" min="0" max="100" step="any" value={form.reductionPct} onChange={set('reductionPct')} required /></label>
          <label>Baseline kg (optional)<input type="number" min="0" step="any" value={form.baselineKgOverride} onChange={set('baselineKgOverride')} placeholder="from recorded data" /></label>
          <button>Add target</button>
        </form>
      )}
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Baseline</th><th>Target year</th><th className="num">Reduction</th><th>Baseline basis</th>{can('admin') && <th />}</tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t._id}>
                <td>{t.name}</td><td>{t.baselineYear}</td><td>{t.targetYear}</td><td className="num">{t.reductionPct}%</td>
                <td>{t.baselineKgOverride != null ? `${t.baselineKgOverride.toLocaleString()} kg (manual)` : 'Recorded emissions'}</td>
                {can('admin') && <td><button className="link danger" onClick={() => remove(t._id)}>{confirmId === t._id ? 'Confirm delete?' : 'Delete'}</button></td>}
              </tr>
            ))}
            {!items.length && <tr><td colSpan="6" className="muted">No targets defined.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
