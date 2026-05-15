import { Router } from 'express';
import Exercise from '../models/Exercise.js';

const router = Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLimit(value) {
  const limit = Number.parseInt(value, 10);
  if (Number.isNaN(limit)) return 50;
  return Math.min(Math.max(limit, 1), 100);
}

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);

    const regex = new RegExp(escapeRegex(q), 'i');
    const exercises = await Exercise.find({
      $or: [
        { name: regex },
        { aliases: regex },
      ],
    })
      .sort({ name: 1 })
      .limit(parseLimit(req.query.limit));

    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { muscle, equipment } = req.query;
    const filter = {};

    if (equipment) {
      filter.equipment = String(equipment).trim().toLowerCase();
    }

    if (muscle) {
      const regex = new RegExp(escapeRegex(String(muscle).trim()), 'i');
      filter.$or = [
        { primaryMuscle: regex },
        { secondaryMuscles: regex },
      ];
    }

    const exercises = await Exercise.find(filter)
      .sort({ name: 1 })
      .limit(parseLimit(req.query.limit));

    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
