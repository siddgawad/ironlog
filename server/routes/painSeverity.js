import { Router } from 'express';
import ProgramState from '../models/ProgramState.js';
import Plan from '../models/Plan.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { joint, severity } = req.body;

    if (severity === 2) {
      const futurePlans = await Plan.find({
        userId: req.userId,
        plannedDate: { $gte: new Date() },
        status: { $in: ['planned', 'adapted'] },
      });

      for (const plan of futurePlans) {
        const hasBench = plan.exercises.some((e) =>
          e.name.toLowerCase().includes('bench')
        );
        if (hasBench) {
          await Plan.findByIdAndUpdate(plan._id, {
            status: 'held',
            adaptationNote: `Bench held — ${joint} pain severity 2`,
            updatedAt: new Date(),
          });
        }
      }

      const update = { updatedAt: new Date(), 'flags.benchPaused': true };
      if (joint === 'elbow') update['flags.elbowPainFlagged'] = false;
      if (joint === 'shoulder') update['flags.shoulderPainFlagged'] = false;

      const state = await ProgramState.findOneAndUpdate(
        { userId: req.userId },
        update,
        { new: true }
      );
      return res.json({
        benchPaused: true,
        message: 'Bench sessions held pending pain resolution',
        state: { ...state.toObject(), initialized: true },
      });
    }

    const update = { updatedAt: new Date() };
    if (joint === 'elbow') update['flags.elbowPainFlagged'] = false;
    if (joint === 'shoulder') update['flags.shoulderPainFlagged'] = false;

    const state = await ProgramState.findOneAndUpdate(
      { userId: req.userId },
      update,
      { new: true }
    );
    res.json({
      monitoring: true,
      state: { ...state.toObject(), initialized: true },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
