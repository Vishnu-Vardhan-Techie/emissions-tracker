import { Router } from 'express';
import { Target } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function validate(b, partial = false) {
  const out = {};
  const need = (k) => !partial && b[k] === undefined;
  if (need('name') || (b.name !== undefined && !String(b.name).trim())) return { error: 'name is required' };
  if (b.name !== undefined) out.name = String(b.name).trim();
  for (const k of ['baselineYear', 'targetYear']) {
    if (need(k)) return { error: `${k} is required` };
    if (b[k] !== undefined) {
      const n = Number(b[k]);
      if (!Number.isInteger(n) || n < 1990 || n > 2100) return { error: `${k} must be a valid year` };
      out[k] = n;
    }
  }
  if (need('reductionPct')) return { error: 'reductionPct is required' };
  if (b.reductionPct !== undefined) {
    const n = Number(b.reductionPct);
    if (!(n >= 0 && n <= 100)) return { error: 'reductionPct must be between 0 and 100' };
    out.reductionPct = n;
  }
  if (b.baselineKgOverride !== undefined && b.baselineKgOverride !== null && b.baselineKgOverride !== '') {
    const n = Number(b.baselineKgOverride);
    if (!(n >= 0)) return { error: 'baselineKgOverride must be non-negative' };
    out.baselineKgOverride = n;
  }
  return { value: out };
}

router.get('/', async (req, res) => {
  res.json(await Target.find({ org: req.user.org }).sort({ targetYear: 1 }).lean());
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { error, value } = validate(req.body || {});
  if (error) return res.status(400).json({ error });
  if (value.targetYear <= value.baselineYear) return res.status(400).json({ error: 'targetYear must be after baselineYear' });
  res.status(201).json(await Target.create({ ...value, org: req.user.org }));
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const { error, value } = validate(req.body || {}, true);
  if (error) return res.status(400).json({ error });
  const doc = await Target.findOneAndUpdate({ _id: req.params.id, org: req.user.org }, value, { new: true });
  if (!doc) return res.status(404).json({ error: 'Target not found' });
  res.json(doc);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const r = await Target.deleteOne({ _id: req.params.id, org: req.user.org });
  if (!r.deletedCount) return res.status(404).json({ error: 'Target not found' });
  res.status(204).end();
});

export default router;
