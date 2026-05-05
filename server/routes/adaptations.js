import { Router } from 'express';
import Adaptation from '../models/Adaptation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const adaptations = await Adaptation.find({ userId: req.userId }).sort({ timestamp: -1 });
    res.json(adaptations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
