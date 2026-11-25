import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { DEMO } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Activities from './pages/Activities.jsx';
import Upload from './pages/Upload.jsx';
import Targets from './pages/Targets.jsx';
import Users from './pages/Users.jsx';
import Factors from './pages/Factors.jsx';

function Guard({ need, children }) {
  const { user, ready, can } = useAuth();
  if (!ready) return <p className="muted pad">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (need && !can(need)) return <p className="pad">You don’t have permission to view this page.</p>;
  return children;
}

function Shell({ children }) {
  const { user, logout, can } = useAuth();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Emissions<br />Tracker</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/activities">Activities</NavLink>
          {can('write') && <NavLink to="/upload">Upload data</NavLink>}
          <NavLink to="/targets">Targets</NavLink>
          <NavLink to="/factors">Emission factors</NavLink>
          {can('admin') && <NavLink to="/users">Users</NavLink>}
        </nav>
        <div className="who">
          <div>{user.name}</div>
          <div className="muted small">{user.role} · {user.org}</div>
          <button className="link" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        {DEMO && <div className="demo-banner">Demo mode: sample data held in your browser; changes reset on reload. Sign out to switch role (admin / analyst / viewer).</div>}
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <Guard>
          <Shell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/upload" element={<Guard need="write"><Upload /></Guard>} />
              <Route path="/targets" element={<Targets />} />
              <Route path="/factors" element={<Factors />} />
              <Route path="/users" element={<Guard need="admin"><Users /></Guard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </Guard>
      } />
    </Routes>
  );
}
