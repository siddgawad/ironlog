import { Router } from 'express';
import CheckIn from '../models/CheckIn.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/progress/checkins — latest 52 check-ins for the user
router.get('/', requireAuth, async (req, res) => {
  try {
    const checkins = await CheckIn.find({ userId: req.userId })
      .sort({ date: -1 })
      .limit(52)
      .select('-userId -__v');
    res.json(checkins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/progress/checkins — log a new check-in
router.post('/', requireAuth, async (req, res) => {
  try {
    const { weightKg, energyLevel, adherence, notes } = req.body;

    if (weightKg !== undefined && (typeof weightKg !== 'number' || weightKg <= 0)) {
      return res.status(400).json({ error: 'INVALID_WEIGHT' });
    }
    if (energyLevel !== undefined && (energyLevel < 1 || energyLevel > 5)) {
      return res.status(400).json({ error: 'INVALID_ENERGY_LEVEL' });
    }
    if (adherence !== undefined && (adherence < 1 || adherence > 5)) {
      return res.status(400).json({ error: 'INVALID_ADHERENCE' });
    }

    const checkIn = await CheckIn.create({
      userId: req.userId,
      weightKg: weightKg ?? null,
      energyLevel: energyLevel ?? null,
      adherence: adherence ?? null,
      notes: String(notes ?? '').slice(0, 500),
    });

    res.json(checkIn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
