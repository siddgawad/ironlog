import { Router } from 'express';
import Plan from '../models/Plan.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.userId }).sort({ plannedDate: 1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/today', requireAuth, async (req, res) => {
  try {
    const next = await Plan.findOne({
      userId: req.userId,
      status: { $in: ['planned', 'adapted'] },
    }).sort({ plannedDate: 1 });
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
