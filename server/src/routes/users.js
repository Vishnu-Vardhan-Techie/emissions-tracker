import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, ROLES } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireRole('admin'));

const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, active: u.active, createdAt: u.createdAt });

router.get('/', async (req, res) => {
  const users = await User.find({ org: req.user.org }).sort({ createdAt: 1 }).lean();
  res.json(users.map(pub));
});

router.post('/', async (req, res) => {
  const { name, email, password, role = 'viewer' } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of ${ROLES.join(', ')}` });
  if (await User.exists({ email: String(email).toLowerCase() })) return res.status(409).json({ error: 'Email already in use' });
  const user = await User.create({
    name, email, role, org: req.user.org, passwordHash: await bcrypt.hash(String(password), 12),
  });
  res.status(201).json(pub(user));
});

router.patch('/:id', async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, org: req.user.org });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { role, active, password, name } = req.body || {};
  const isSelf = String(user._id) === req.user.id;
  if (isSelf && (role !== undefined && role !== 'admin' || active === false)) {
    return res.status(400).json({ error: 'You cannot demote or deactivate your own account' });
  }
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of ${ROLES.join(', ')}` });
    user.role = role;
  }
  if (active !== undefined) user.active = Boolean(active);
  if (name) user.name = name;
  if (password) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    user.passwordHash = await bcrypt.hash(String(password), 12);
  }
  await user.save();
  res.json(pub(user));
});

export default router;
