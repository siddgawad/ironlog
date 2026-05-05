import { Router } from 'express';
import ProgramState from '../models/ProgramState.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const state = await ProgramState.findOne({ userId: req.userId });
    if (!state) return res.json({ initialized: false });
    res.json({ ...state.toObject(), initialized: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
