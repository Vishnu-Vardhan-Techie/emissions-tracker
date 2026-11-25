import { Router } from 'express';
import { Factor } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await Factor.find().sort({ scope: 1, category: 1, key: 1 }).lean());
});

// Admins keep the library aligned with the current published datasets.
router.patch('/:key', requireRole('admin'), async (req, res) => {
  const update = {};
  if (req.body.factor !== undefined) {
    const f = Number(req.body.factor);
    if (!Number.isFinite(f) || f < 0) return res.status(400).json({ error: 'factor must be a non-negative number' });
    update.factor = f;
  }
  for (const k of ['source', 'year']) if (req.body[k] !== undefined) update[k] = req.body[k];
  const doc = await Factor.findOneAndUpdate({ key: req.params.key }, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Factor not found' });
  res.json(doc);
});

export default router;
