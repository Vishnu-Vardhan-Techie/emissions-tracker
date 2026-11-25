import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { DEMO } from '../api.js';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <h1>Emissions Tracker</h1>
        <p className="muted">Sign in to view your carbon footprint.</p>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {DEMO && (
          <div className="demo-box">
            <div className="small muted">Interactive demo with sample data. Sign in as:</div>
            <div className="row gap">
              {[['admin', 'Admin'], ['analyst', 'Analyst'], ['viewer', 'Viewer']].map(([r, label]) => (
                <button type="button" className="secondary" key={r} disabled={busy}
                  onClick={() => { setBusy(true); setError(''); login(`${r}@demo.io`, 'demo').catch((e) => setError(e.message)).finally(() => setBusy(false)); }}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
