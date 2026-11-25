import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const today = () => new Date().toISOString().slice(0, 10);

export default function Activities() {
  const { can } = useAuth();
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [factors, setFactors] = useState([]);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [form, setForm] = useState({ date: today(), factorKey: '', quantity: '', unit: '', facility: '', description: '' });
  const limit = 25;

  const load = useCallback(() => api(`/activities?page=${page}&limit=${limit}`).then(setData).catch((e) => setError(e.message)), [page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/factors').then(setFactors).catch(() => {}); }, []);

  const factor = factors.find((f) => f.key === form.factorKey);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api('/activities', { method: 'POST', body: { ...form, quantity: Number(form.quantity), unit: form.unit || factor?.unit } });
      setForm({ ...form, quantity: '', description: '' });
      page === 1 ? load() : setPage(1);
    } catch (err) { setError(err.message); }
  };
  const remove = async (id) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId(null);
    try { await api(`/activities/${id}`, { method: 'DELETE' }); load(); } catch (err) { setError(err.message); }
  };

  const pages = Math.max(1, Math.ceil(data.total / limit));
  return (
    <div>
      <h1>Activities</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {can('write') && (
        <form className="card form-row" onSubmit={add}>
          <label>Date<input type="date" value={form.date} onChange={set('date')} required /></label>
          <label>Activity
            <select value={form.factorKey} onChange={(e) => setForm({ ...form, factorKey: e.target.value, unit: '' })} required>
              <option value="">Select…</option>
              {factors.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
          <label>Quantity<input type="number" min="0" step="any" value={form.quantity} onChange={set('quantity')} required /></label>
          <label>Unit<input value={form.unit} placeholder={factor?.unit || ''} onChange={set('unit')} /></label>
          <label>Facility<input value={form.facility} onChange={set('facility')} /></label>
          <label className="grow">Description<input value={form.description} onChange={set('description')} /></label>
          <button>Add</button>
        </form>
      )}
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="num">Quantity</th><th className="num">kg CO₂e</th><th>Scope</th><th>Source</th>{can('write') && <th />}</tr></thead>
          <tbody>
            {data.items.map((a) => (
              <tr key={a._id}>
                <td>{a.date.slice(0, 10)}</td><td>{a.category}</td><td>{a.description || a.factorKey}</td>
                <td className="num">{a.quantity.toLocaleString()} {a.unit}</td>
                <td className="num">{a.kgCo2e.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                <td>{a.scope}</td><td>{a.source}</td>
                {can('write') && <td><button className="link danger" onClick={() => remove(a._id)}>{confirmId === a._id ? 'Confirm delete?' : 'Delete'}</button></td>}
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan="8" className="muted">No activities yet.</td></tr>}
          </tbody>
        </table>
        <div className="row between pager">
          <span className="muted small">{data.total} records</span>
          <span>
            <button className="link" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="small"> Page {page} of {pages} </span>
            <button className="link" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </span>
        </div>
      </div>
    </div>
  );
}
