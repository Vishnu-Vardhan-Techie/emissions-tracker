import { Router } from 'express';
import { Activity, Factor } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { calculateEmissions } from '../engine/calculate.js';

const router = Router();

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const q = { org: req.user.org };
  if (req.query.category) q.category = String(req.query.category);
  if (req.query.scope) q.scope = Number(req.query.scope);
  if (req.query.from || req.query.to) {
    q.date = {};
    if (req.query.from) q.date.$gte = new Date(req.query.from);
    if (req.query.to) q.date.$lte = new Date(req.query.to);
  }
  const [items, total] = await Promise.all([
    Activity.find(q).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Activity.countDocuments(q),
  ]);
  res.json({ items, total, page, limit });
});

router.post('/', requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const { date, factorKey, quantity, unit, facility = '', description = '' } = req.body || {};
    const d = new Date(date);
    if (!date || Number.isNaN(d.getTime())) return res.status(400).json({ error: 'valid date is required' });
    const factor = await Factor.findOne({ key: factorKey }).lean();
    if (!factor) return res.status(400).json({ error: `unknown factorKey "${factorKey}"` });
    const { quantityNative, kgCo2e } = calculateEmissions({ quantity: Number(quantity), unit }, factor);
    const doc = await Activity.create({
      org: req.user.org, date: d, factorKey: factor.key, category: factor.category, scope: factor.scope,
      quantity: Number(quantity), unit: unit || factor.unit, quantityNative, kgCo2e,
      facility, description, source: 'manual', createdBy: req.user.id,
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireRole('admin', 'analyst'), async (req, res) => {
  const r = await Activity.deleteOne({ _id: req.params.id, org: req.user.org });
  if (!r.deletedCount) return res.status(404).json({ error: 'Activity not found' });
  res.status(204).end();
});

export default router;
