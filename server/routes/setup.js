import { Router } from 'express';
import ProgramState from '../models/ProgramState.js';
import Plan from '../models/Plan.js';
import {
  BENCH_LOADS,
  SQUAT_LOADS,
  DEADLIFT_LOADS,
  REST_SECONDS,
  DAY_TEMPLATES,
} from '../data/program.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function getLoadLb(loadKey, mc) {
  if (!loadKey) return 0;
  if (loadKey.startsWith('bench_')) return BENCH_LOADS[mc][loadKey.slice(6)] ?? 0;
  if (loadKey === 'squat_comp') return SQUAT_LOADS.comp[mc] ?? 0;
  if (loadKey === 'squat_pause') return SQUAT_LOADS.pause[mc] ?? 0;
  if (loadKey === 'deadlift') return DEADLIFT_LOADS[mc] ?? 0;
  return 0;
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const existing = await ProgramState.findOne({ userId: req.userId });
    if (existing) return res.json({ alreadyInitialized: true });

    const { programStartDate } = req.body;
    const startDate = programStartDate ? new Date(programStartDate) : new Date();

    await ProgramState.create({
      userId: req.userId,
      programStartDate: startDate,
      currentMicrocycle: 1,
      currentDayIndex: 0,
    });

    const plans = [];
    let dayOffset = 0;

    for (let mc = 1; mc <= 3; mc++) {
      for (const template of DAY_TEMPLATES) {
        const plannedDate = new Date(startDate);
        plannedDate.setDate(plannedDate.getDate() + dayOffset);

        const exercises = template.exercises.map((ex) => ({
          name: ex.name,
          category: ex.category,
          sets: ex.sets,
          reps: ex.reps,
          loadLb: ex.loadKey ? getLoadLb(ex.loadKey, mc) : (ex.loadLb ?? 0),
          rpeTarget: ex.rpeTarget ?? null,
          restSeconds: ex.restKey ? (REST_SECONDS[ex.restKey] ?? 90) : 90,
          notes: ex.notes ?? '',
        }));

        plans.push({
          userId: req.userId,
          plannedDate,
          microcycle: mc,
          dayNumber: template.dayNumber,
          dayType: template.dayType,
          status: 'planned',
          exercises,
        });

        dayOffset++;
      }
    }

    await Plan.insertMany(plans);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
