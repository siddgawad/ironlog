import { Router } from 'express';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import Plan from '../models/Plan.js';
import ProgramState from '../models/ProgramState.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePro } from '../middleware/proGate.js';

const router = Router();
const DIFF_TTL_MS = 10 * 60 * 1000;
const diffTokens = new Map();

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, value] of diffTokens.entries()) {
    if (value.expiresAt <= now) diffTokens.delete(token);
  }
}

function formatProfile(user) {
  return {
    primaryGoal: user.primaryGoal,
    experienceLevel: user.experienceLevel,
    daysPerWeek: user.daysPerWeek,
    equipment: user.equipment,
    currentLifts: user.currentLifts || {},
    injuries: user.injuries || '',
  };
}

function serializePlan(plan) {
  return {
    _id: plan._id.toString(),
    plannedDate: plan.plannedDate?.toISOString(),
    dayType: plan.dayType,
    status: plan.status,
    exercises: plan.exercises.map((exercise) => ({
      name: exercise.name,
      category: exercise.category,
      sets: exercise.sets,
      reps: exercise.reps,
      loadLb: exercise.loadLb,
      rpeTarget: exercise.rpeTarget,
      restSeconds: exercise.restSeconds,
      notes: exercise.notes,
    })),
  };
}

function buildReplanPrompt({ user, remainingPlans, missedPlans, reason }) {
  return `You are IronLog's schedule restructuring engine. Propose a revised schedule, but do not apply changes.

Return JSON only with this shape:
{
  "summary": "plain English summary",
  "removed": [{ "_id": "existing plan id", "reason": "why this is dropped" }],
  "rescheduled": [{ "_id": "existing plan id", "newDate": "ISO date", "reason": "why this moves" }],
  "added": [
    {
      "date": "ISO date",
      "dayType": "string",
      "exercises": [
        { "name": "string", "category": "main|secondary|accessory", "sets": 3, "reps": 8, "loadLb": 0, "rpeTarget": 7, "restSeconds": 90, "notes": "string" }
      ]
    }
  ]
}

Rules:
- Respect the user's equipment and injuries.
- Keep the training week realistic; reduce volume when pain, illness, travel, or fatigue is the reason.
- Do not add more weekly training days than the user's daysPerWeek.
- Prefer rescheduling over adding sessions when possible.
- If the reason mentions pain, reduce or remove movements that stress the painful area.
- Only reference _id values from remainingSessions when removing or rescheduling existing sessions.

User profile:
${JSON.stringify(formatProfile(user), null, 2)}

Reason:
${reason || 'not provided'}

Missed sessions:
${JSON.stringify(missedPlans.map(serializePlan), null, 2)}

Remaining unfinished sessions:
${JSON.stringify(remainingPlans.map(serializePlan), null, 2)}`;
}

async function generateReplan({ user, remainingPlans, missedPlans, reason }) {
  const completion = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: buildReplanPrompt({ user, remainingPlans, missedPlans, reason }),
      },
      { role: 'user', content: 'Create a replan diff for this user.' },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4096,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty replan response');
  return JSON.parse(content);
}

function normalizeExercise(exercise) {
  const category = ['main', 'secondary', 'accessory'].includes(exercise.category)
    ? exercise.category
    : 'accessory';

  return {
    name: String(exercise.name || '').trim(),
    category,
    sets: Number(exercise.sets || 0),
    reps: Number(exercise.reps || 0),
    loadLb: Number(exercise.loadLb || 0),
    rpeTarget: exercise.rpeTarget == null ? null : Number(exercise.rpeTarget),
    restSeconds: Number(exercise.restSeconds || 90),
    notes: String(exercise.notes || ''),
  };
}

function buildDiff(candidate, remainingPlans) {
  const planById = new Map(remainingPlans.map((plan) => [plan._id.toString(), plan]));

  const removed = (candidate.removed || [])
    .map((item) => {
      const id = String(item._id || item.id || item);
      const plan = planById.get(id);
      if (!plan) return null;
      return {
        _id: id,
        date: plan.plannedDate?.toISOString(),
        dayType: plan.dayType,
        reason: item.reason || '',
      };
    })
    .filter(Boolean);

  const rescheduled = (candidate.rescheduled || [])
    .map((item) => {
      const id = String(item._id || item.id || '');
      const plan = planById.get(id);
      const newDate = item.newDate ? new Date(item.newDate) : null;
      if (!plan || !newDate || Number.isNaN(newDate.getTime())) return null;
      return {
        _id: id,
        oldDate: plan.plannedDate?.toISOString(),
        newDate: newDate.toISOString(),
        dayType: plan.dayType,
        reason: item.reason || '',
      };
    })
    .filter(Boolean);

  const added = (candidate.added || [])
    .map((item) => {
      const date = item.date ? new Date(item.date) : null;
      if (!date || Number.isNaN(date.getTime())) return null;
      return {
        date: date.toISOString(),
        dayType: String(item.dayType || 'Training'),
        exercises: Array.isArray(item.exercises)
          ? item.exercises.map(normalizeExercise).filter((exercise) => exercise.name)
          : [],
      };
    })
    .filter(Boolean);

  return {
    summary: String(candidate.summary || 'Proposed schedule adjustment.'),
    removed,
    rescheduled,
    added,
  };
}

function calculateDayNumber(programState, date) {
  if (!programState?.programStartDate) return 1;
  const start = new Date(programState.programStartDate);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(diffDays + 1, 1);
}

router.post('/', requireAuth, requirePro, async (req, res) => {
  try {
    cleanupExpiredTokens();

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    const missedPlanIds = Array.isArray(req.body.missedPlanIds)
      ? req.body.missedPlanIds.map(String)
      : [];
    const reason = String(req.body.reason || '').trim();

    const remainingPlans = await Plan.find({
      userId: req.userId,
      status: { $in: ['planned', 'missed'] },
    }).sort({ plannedDate: 1 });

    if (!remainingPlans.length) {
      return res.status(400).json({ error: 'NO_UNFINISHED_SESSIONS' });
    }

    const missedPlans = missedPlanIds.length
      ? remainingPlans.filter((plan) => missedPlanIds.includes(plan._id.toString()))
      : remainingPlans.filter((plan) => plan.status === 'missed');

    const candidate = await generateReplan({ user, remainingPlans, missedPlans, reason });
    const diff = buildDiff(candidate, remainingPlans);
    const diffToken = crypto.randomUUID();

    diffTokens.set(diffToken, {
      userId: req.userId.toString(),
      diff,
      expiresAt: Date.now() + DIFF_TTL_MS,
    });

    res.json({ diffToken, diff });
  } catch (err) {
    console.error('Replan error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/confirm', requireAuth, async (req, res) => {
  try {
    cleanupExpiredTokens();

    const { diffToken } = req.body;
    const stored = diffTokens.get(diffToken);
    if (!stored) return res.status(400).json({ error: 'INVALID_OR_EXPIRED_DIFF_TOKEN' });
    if (stored.userId !== req.userId.toString()) return res.status(403).json({ error: 'TOKEN_USER_MISMATCH' });

    diffTokens.delete(diffToken);

    const programState = await ProgramState.findOne({ userId: req.userId });

    for (const removed of stored.diff.removed) {
      await Plan.findOneAndUpdate(
        { _id: removed._id, userId: req.userId },
        {
          status: 'held',
          adaptationNote: removed.reason ? `Removed during replan: ${removed.reason}` : 'Removed during replan',
          updatedAt: new Date(),
        }
      );
    }

    for (const item of stored.diff.rescheduled) {
      await Plan.findOneAndUpdate(
        { _id: item._id, userId: req.userId },
        {
          plannedDate: new Date(item.newDate),
          status: 'planned',
          adaptationNote: item.reason ? `Rescheduled during replan: ${item.reason}` : 'Rescheduled during replan',
          updatedAt: new Date(),
        }
      );
    }

    if (stored.diff.added.length) {
      const addedPlans = stored.diff.added.map((item) => {
        const plannedDate = new Date(item.date);
        const dayNumber = calculateDayNumber(programState, plannedDate);
        return {
          userId: req.userId,
          plannedDate,
          microcycle: Math.max(Math.ceil(dayNumber / 7), 1),
          dayNumber,
          dayType: item.dayType,
          status: 'planned',
          adaptationNote: 'Added during replan',
          exercises: item.exercises,
        };
      });

      await Plan.insertMany(addedPlans);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Replan confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
