import { Router } from 'express';
import Log from '../models/Log.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const LIFT_KEYS = {
  bench: 'bench',
  'bench press': 'bench',
  squat: 'squat',
  deadlift: 'deadlift',
  ohp: 'overheadPress',
  'overhead press': 'overheadPress',
};

function epley(loadLb, reps) {
  return loadLb * (1 + reps / 30);
}

function liftKeyFromQuery(lift) {
  return LIFT_KEYS[String(lift || '').trim().toLowerCase()] || String(lift || '').trim().toLowerCase();
}

function bestReps(liftData) {
  if (Array.isArray(liftData?.repsPerSet) && liftData.repsPerSet.length) {
    const reps = liftData.repsPerSet.map(Number).filter(Number.isFinite);
    return reps.length ? Math.max(...reps) : 0;
  }

  const reps = Number(liftData?.reps || liftData?.repsCompleted);
  return Number.isFinite(reps) ? reps : 0;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const lift = String(req.query.lift || '').trim();
    if (!lift) return res.status(400).json({ error: 'LIFT_REQUIRED' });

    const liftKey = liftKeyFromQuery(lift);
    const dateFilter = {};
    if (req.query.from) dateFilter.$gte = new Date(req.query.from);
    if (req.query.to) dateFilter.$lte = new Date(req.query.to);

    if (
      (dateFilter.$gte && Number.isNaN(dateFilter.$gte.getTime())) ||
      (dateFilter.$lte && Number.isNaN(dateFilter.$lte.getTime()))
    ) {
      return res.status(400).json({ error: 'INVALID_DATE_RANGE' });
    }

    const filter = { userId: req.userId };
    if (Object.keys(dateFilter).length) filter.date = dateFilter;

    const logs = await Log.find(filter, { chatHistory: 0 }).sort({ date: 1 });
    const points = logs.flatMap((log) => {
      const liftData = log.extractedData?.[liftKey];
      const loadLb = Number(liftData?.loadLb || 0);
      const reps = bestReps(liftData);

      if (!loadLb || !reps) return [];

      return [{
        date: log.date,
        e1rm: Number(epley(loadLb, reps).toFixed(1)),
        loadLb,
        reps,
      }];
    });

    res.json({ lift, points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
