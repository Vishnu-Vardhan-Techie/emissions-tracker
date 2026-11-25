import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export function signToken(user, secret = process.env.JWT_SECRET, expiresIn = '8h') {
  return jwt.sign({ sub: String(user._id), role: user.role, org: user.org }, secret, { expiresIn });
}

/** Verifies the bearer token and loads the (still active) user. */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.active) return res.status(401).json({ error: 'Account unavailable' });
    // Role and org come from the database, not the token, so changes apply immediately.
    req.user = { id: String(user._id), role: user.role, org: user.org, name: user.name, email: user.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Allows only the listed roles. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
