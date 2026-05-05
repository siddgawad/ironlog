import { Router } from 'express';
import Log from '../models/Log.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const logs = await Log.find({ userId: req.userId }, { chatHistory: 0 }).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const log = await Log.findOne({ _id: req.params.id, userId: req.userId });
    if (!log) return res.status(404).json({ error: 'Log not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
