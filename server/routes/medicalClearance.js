import { Router } from 'express';
import ProgramState from '../models/ProgramState.js';
import Plan from '../models/Plan.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    await Plan.updateMany(
      { userId: req.userId, status: 'held' },
      { status: 'planned', updatedAt: new Date() }
    );
    const state = await ProgramState.findOneAndUpdate(
      { userId: req.userId },
      { 'flags.medicalStop': false, updatedAt: new Date() },
      { new: true }
    );
    res.json({ ...state.toObject(), initialized: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
