import { Router } from 'express';
import Plan from '../models/Plan.js';
import Log from '../models/Log.js';
import Adaptation from '../models/Adaptation.js';
import ProgramState from '../models/ProgramState.js';
import { runAdaptations } from '../engine/adaptations.js';
import { epley1RM } from '../data/program.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { planDayId, extractedData, chatHistory } = req.body;

    const planDay = await Plan.findOne({ _id: planDayId, userId: req.userId });
    if (!planDay) return res.status(404).json({ error: 'Plan day not found' });

    const programState = await ProgramState.findOne({ userId: req.userId });
    if (!programState) return res.status(400).json({ error: 'Program not initialized' });

    if (extractedData?.bench?.loadLb && extractedData.bench.repsPerSet?.length) {
      const bestReps = Math.max(...extractedData.bench.repsPerSet);
      extractedData.bench.estimatedOneRM = epley1RM(extractedData.bench.loadLb, bestReps);
    }

    const log = await Log.create({
      userId: req.userId,
      planDayId,
      date: new Date(),
      sessionType: extractedData.sessionType,
      missedReason: extractedData.missedReason || null,
      extractedData,
      chatHistory: chatHistory || [],
    });

    const planStatus = extractedData.sessionType === 'missed' ? 'missed' : 'completed';
    await Plan.findByIdAndUpdate(planDayId, { status: planStatus, updatedAt: new Date() });

    const { updatedFlags, updatedState, adaptationDocs } = await runAdaptations(log, programState);

    const savedAdaptations = adaptationDocs.length
      ? await Adaptation.insertMany(
          adaptationDocs.map((doc) => ({ ...doc, userId: req.userId }))
        )
      : [];

    const newDayIndex = (programState.currentDayIndex + 1) % 8;
    const newMicrocycle =
      programState.currentDayIndex === 7
        ? Math.min(programState.currentMicrocycle + 1, 3)
        : programState.currentMicrocycle;

    const stateUpdate = {
      flags: updatedFlags,
      currentDayIndex: newDayIndex,
      currentMicrocycle: newMicrocycle,
      updatedAt: new Date(),
      ...updatedState,
    };

    const updatedProgramState = await ProgramState.findByIdAndUpdate(
      programState._id,
      stateUpdate,
      { new: true }
    );

    const triggeredRules = savedAdaptations.map((a) => a.rule);
    await Log.findByIdAndUpdate(log._id, { adaptationsTriggered: triggeredRules });

    res.json({
      log,
      adaptationsTriggered: triggeredRules,
      updatedState: { ...updatedProgramState.toObject(), initialized: true },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
