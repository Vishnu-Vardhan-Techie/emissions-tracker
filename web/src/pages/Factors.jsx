import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Factors() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // { key, factor, source }
  const load = useCallback(() => api('/factors').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    try {
      await api(`/factors/${editing.key}`, { method: 'PATCH', body: { factor: Number(editing.factor), source: editing.source } });
      setEditing(null); load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <h1>Emission factors</h1>
      <p className="muted">kg CO₂e per unit of activity. Default values are representative; admins should verify and update them against the current EPA, DEFRA, IPCC or IEA release before reporting.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Key</th><th>Activity</th><th>Scope</th><th>Unit</th><th className="num">Factor</th><th>Source</th><th>Year</th>{can('admin') && <th />}</tr></thead>
          <tbody>
            {items.map((f) => {
              const e = editing?.key === f.key ? editing : null;
              return (
                <tr key={f.key}>
                  <td><code>{f.key}</code></td><td>{f.label}</td><td>{f.scope}</td><td>{f.unit}</td>
                  <td className="num">{e ? <input type="number" min="0" step="any" style={{ width: 90 }} value={e.factor} onChange={(ev) => setEditing({ ...e, factor: ev.target.value })} /> : f.factor}</td>
                  <td>{e ? <input value={e.source} onChange={(ev) => setEditing({ ...e, source: ev.target.value })} /> : f.source}</td>
                  <td>{f.year}</td>
                  {can('admin') && (
                    <td>{e
                      ? <><button className="link" onClick={save}>Save</button><button className="link" onClick={() => setEditing(null)}>Cancel</button></>
                      : <button className="link" onClick={() => setEditing({ key: f.key, factor: f.factor, source: f.source })}>Edit</button>}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
