import { Router } from 'express';
import Groq from 'groq-sdk';
import ProgramState from '../models/ProgramState.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

function formatCurrentLifts(currentLifts) {
  const entries = Object.entries(currentLifts?.toObject?.() || currentLifts || {})
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([lift, value]) => `${lift}: ${value}`);
  return entries.length ? entries.join(', ') : 'not provided';
}

function equipmentRules(equipment) {
  switch (equipment) {
    case 'bodyweight':
      return 'Use bodyweight exercises only. Do not prescribe weights, cables, or machines.';
    case 'dumbbells_only':
      return 'Use dumbbell and bodyweight exercises only. Do not prescribe barbell, cable, or machine exercises.';
    case 'home_gym':
      return 'Use common home-gym movements. Avoid specialty machines unless the user listed them.';
    case 'full_gym':
      return 'Full commercial gym equipment is available.';
    default:
      return 'Use conservative equipment assumptions and avoid specialty equipment.';
  }
}

function buildProgramGenerationPrompt(user) {
  const daysPerWeek = user.daysPerWeek || 3;
  const currentLifts = formatCurrentLifts(user.currentLifts);
  const injuries = user.injuries?.trim() || 'none';

  return `You are a certified strength and conditioning coach. Generate a personalized training program.

User profile:
- Goal: ${user.primaryGoal || 'general_fitness'}
- Experience: ${user.experienceLevel || 'beginner'}
- Equipment: ${user.equipment || 'bodyweight'}
- Days per week: ${daysPerWeek}
- Current lifts (lb): ${currentLifts}
- Injuries/limitations: ${injuries}

Rules:
- Match equipment strictly (never prescribe barbell exercises for "bodyweight" users)
- ${equipmentRules(user.equipment)}
- Match experience (beginners: 3x8-12 compounds; advanced: periodized with RPE)
- Match goal (strength: low rep high intensity; hypertrophy: moderate rep ranges; weight_loss: circuit-style)
- Include rest days
- Do NOT generate more than ${daysPerWeek} training days per week
- Use only exercises the user can do with their equipment
- loadPercent is % of 1RM if currentLifts provided, else 0
- Return exactly 4 weeks.
- Return JSON only. No Markdown.

JSON schema:
{
  "programName": "string",
  "phase": "string",
  "weeks": [
    {
      "weekNumber": 1,
      "sessions": [
        {
          "dayOffset": 0,
          "dayType": "string",
          "exercises": [
            {
              "name": "string",
              "category": "main|secondary|accessory",
              "sets": 3,
              "reps": 8,
              "loadPercent": 70,
              "rpeTarget": 7,
              "restSeconds": 90,
              "notes": "string"
            }
          ]
        }
      ]
    }
  ]
}`;
}

async function generateProgram(user) {
  const completion = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: buildProgramGenerationPrompt(user) },
      { role: 'user', content: 'Generate my first 4-week IronLog program.' },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 4096,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty program response');

  const program = JSON.parse(content);
  if (!program.programName || !Array.isArray(program.weeks) || !program.weeks.length) {
    throw new Error('Groq returned an invalid program shape');
  }

  return program;
}

function liftKeyForExercise(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('bench')) return 'bench';
  if (lower.includes('squat')) return 'squat';
  if (lower.includes('deadlift')) return 'deadlift';
  if (
    lower.includes('overhead press') ||
    lower.includes('shoulder press') ||
    lower.includes('military press')
  ) {
    return 'overheadPress';
  }
  return null;
}

function roundToNearestFive(value) {
  return Math.round(value / 5) * 5;
}

function loadPercentToLb(exercise, currentLifts) {
  const percent = Number(exercise.loadPercent || 0);
  if (!percent) return 0;

  const liftKey = liftKeyForExercise(exercise.name);
  if (!liftKey) return 0;

  const max = Number(currentLifts?.[liftKey] || 0);
  if (!max) return 0;

  return roundToNearestFive(max * (percent / 100));
}

function normalizeCategory(category) {
  if (['main', 'secondary', 'accessory'].includes(category)) return category;
  return 'accessory';
}

function buildPlanDocuments(program, user, startDate) {
  return program.weeks.flatMap((week, weekIndex) => {
    const sessions = Array.isArray(week.sessions) ? week.sessions : [];

    return sessions.map((session, sessionIndex) => {
      const rawDayOffset = Number(session.dayOffset);
      const dayOffset = Number.isFinite(rawDayOffset)
        ? rawDayOffset
        : weekIndex * 7 + sessionIndex;
      const plannedDate = new Date(startDate);
      plannedDate.setDate(plannedDate.getDate() + dayOffset);

      const exercises = Array.isArray(session.exercises)
        ? session.exercises.map((exercise) => ({
            name: String(exercise.name || '').trim(),
            category: normalizeCategory(exercise.category),
            sets: Number(exercise.sets || 0),
            reps: Number(exercise.reps || 0),
            loadLb: loadPercentToLb(exercise, user.currentLifts),
            rpeTarget: exercise.rpeTarget == null ? null : Number(exercise.rpeTarget),
            restSeconds: Number(exercise.restSeconds || 90),
            notes: String(exercise.notes || ''),
          })).filter((exercise) => exercise.name)
        : [];

      return {
        userId: user._id,
        plannedDate,
        microcycle: Number(week.weekNumber || weekIndex + 1),
        dayNumber: dayOffset + 1,
        dayType: String(session.dayType || (exercises.length ? 'Training' : 'Rest')),
        status: 'planned',
        exercises,
      };
    });
  });
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const existing = await ProgramState.findOne({ userId: req.userId });
    if (existing) return res.json({ alreadyInitialized: true });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    const requestedStartDate = req.body.programStartDate || req.body.startDate;
    const startDate = requestedStartDate ? new Date(requestedStartDate) : new Date();
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'INVALID_START_DATE' });
    }

    const program = await generateProgram(user);
    const plans = buildPlanDocuments(program, user, startDate);
    if (!plans.length) {
      return res.status(500).json({ error: 'PROGRAM_EMPTY' });
    }

    await ProgramState.create({
      userId: req.userId,
      phase: program.programName,
      programName: program.programName,
      programStartDate: startDate,
      currentMicrocycle: 1,
      currentDayIndex: 0,
    });
    await Plan.insertMany(plans);
    res.json({ success: true, programName: program.programName });
  } catch (err) {
    console.error('Setup generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
