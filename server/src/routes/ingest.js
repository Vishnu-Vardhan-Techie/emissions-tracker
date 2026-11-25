import { Router } from 'express';
import multer from 'multer';
import { Activity, Factor } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { parseActivityCsv, parseInvoiceCsv, TEMPLATES } from '../ingest/csv.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

router.get('/template/:type', (req, res) => {
  const t = TEMPLATES[req.params.type];
  if (!t) return res.status(404).json({ error: 'Unknown template' });
  res.type('text/csv').attachment(`${req.params.type}-template.csv`).send(t);
});

// ?dryRun=true parses and reports without saving.
router.post('/:type', requireRole('admin', 'analyst'), upload.single('file'), async (req, res) => {
  const { type } = req.params;
  if (!['activity', 'invoice'].includes(type)) return res.status(404).json({ error: 'Unknown ingestion type' });
  if (!req.file) return res.status(400).json({ error: 'Attach a CSV file in the "file" field' });
  try {
    const factors = await Factor.find().lean();
    const map = new Map(factors.map((f) => [f.key, f]));
    const { accepted, rejected } = (type === 'activity' ? parseActivityCsv : parseInvoiceCsv)(req.file.buffer, map);
    const totalKg = accepted.reduce((s, a) => s + a.kgCo2e, 0);
    if (req.query.dryRun !== 'true' && accepted.length) {
      await Activity.insertMany(accepted.map((a) => ({ ...a, org: req.user.org, createdBy: req.user.id })));
    }
    res.json({
      dryRun: req.query.dryRun === 'true',
      imported: req.query.dryRun === 'true' ? 0 : accepted.length,
      validRows: accepted.length,
      rejected,
      totalKgCo2e: Math.round(totalKg * 100) / 100,
    });
  } catch (e) {
    res.status(400).json({ error: `Could not parse CSV: ${e.message}` });
  }
});

export default router;
