import { Router } from 'express';
import ProgramState from '../models/ProgramState.js';
import Plan from '../models/Plan.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const state = await ProgramState.findOne({ userId: req.userId });
    if (!state) return res.json({ initialized: false });

    const overdueCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    await Plan.updateMany(
      {
        userId: req.userId,
        status: 'planned',
        plannedDate: { $lt: overdueCutoff },
      },
      { status: 'missed', updatedAt: new Date() }
    );

    const missedSessionCount = await Plan.countDocuments({
      userId: req.userId,
      status: 'missed',
    });

    res.json({ ...state.toObject(), initialized: true, missedSessionCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
