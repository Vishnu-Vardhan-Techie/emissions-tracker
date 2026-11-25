import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/index.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ email });
  // Same response for unknown user and wrong password.
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, org: user.org },
  });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

export default router;
