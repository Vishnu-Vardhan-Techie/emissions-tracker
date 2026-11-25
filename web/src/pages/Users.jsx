import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const [error, setError] = useState('');
  const load = useCallback(() => api('/users').then(setUsers).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault(); setError('');
    try { await api('/users', { method: 'POST', body: form }); setForm({ name: '', email: '', password: '', role: 'viewer' }); load(); }
    catch (err) { setError(err.message); }
  };
  const patch = async (id, body) => {
    setError('');
    try { await api(`/users/${id}`, { method: 'PATCH', body }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <h1>Users</h1>
      <p className="muted">Admins manage everything; analysts add and import data; viewers see dashboards and records.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="card form-row" onSubmit={add}>
        <label>Name<input value={form.name} onChange={set('name')} required /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Temporary password<input type="password" minLength={8} value={form.password} onChange={set('password')} required /></label>
        <label>Role
          <select value={form.role} onChange={set('role')}><option>viewer</option><option>analyst</option><option>admin</option></select>
        </label>
        <button>Add user</button>
      </form>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id}>
                  <td>{u.name}{self && ' (you)'}</td><td>{u.email}</td>
                  <td>
                    <select value={u.role} disabled={self} onChange={(e) => patch(u.id, { role: e.target.value })}>
                      <option>viewer</option><option>analyst</option><option>admin</option>
                    </select>
                  </td>
                  <td>{u.active ? 'Active' : 'Deactivated'}</td>
                  <td>{!self && <button className="link" onClick={() => patch(u.id, { active: !u.active })}>{u.active ? 'Deactivate' : 'Reactivate'}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
