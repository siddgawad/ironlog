import { Router } from 'express';
import Groq from 'groq-sdk';
import ProgramState from '../models/ProgramState.js';
import Plan from '../models/Plan.js';
import Log from '../models/Log.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// Approx token budget — leave room for system prompt + response.
// llama-3.3-70b context is 128k but we cap to keep cost/latency low.
const MAX_HISTORY_TOKENS = 6000;
const APPROX_CHARS_PER_TOKEN = 4;

function truncateHistoryToBudget(messages, budgetTokens) {
  // Keep most-recent messages within budget. Returns oldest-first array.
  const budget = budgetTokens * APPROX_CHARS_PER_TOKEN;
  let total = 0;
  const reversed = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const len = (messages[i].content || '').length;
    if (total + len > budget) break;
    total += len;
    reversed.push(messages[i]);
  }
  return reversed.reverse();
}

async function getOrCreateConversation(userId) {
  let convo = await Conversation.findOne({ userId });
  if (!convo) convo = await Conversation.create({ userId, messages: [] });
  return convo;
}

function formatActiveFlags(flags) {
  return Object.entries(flags?.toObject?.() || flags || {})
    .filter(([, value]) => {
      if (value == null) return false;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value > 0;
      return true;
    })
    .map(([key, value]) => {
      const label = key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (char) => char.toUpperCase());
      if (value instanceof Date) return `${label}: ${value.toISOString()}`;
      if (typeof value === 'boolean') return label;
      return `${label}: ${value}`;
    });
}

async function buildSystemPrompt(userId, planDayId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const planDayQuery = planDayId
    ? Plan.findOne({ _id: planDayId, userId })
    : Plan.findOne({
        userId,
        status: { $in: ['planned', 'adapted'] },
      }).sort({ plannedDate: 1 });

  const [state, planDay, lastThreeLogs] = await Promise.all([
    ProgramState.findOne({ userId }),
    planDayQuery,
    Log.find({ userId }, { chatHistory: 0 }).sort({ date: -1 }).limit(3),
  ]);

  const profileLines = [];
  if (user.age) profileLines.push(`${user.age}${user.sex ? user.sex.charAt(0).toUpperCase() : ''}`);
  if (user.weightKg) profileLines.push(`${user.weightKg} kg`);
  if (user.heightCm) profileLines.push(`${user.heightCm} cm`);
  if (user.experienceLevel) profileLines.push(`${user.experienceLevel} lifter`);
  const profileStr = profileLines.length ? profileLines.join(', ') : 'profile not yet set';

  const goalStr = user.primaryGoal
    ? user.primaryGoal.replace(/_/g, ' ')
    : 'not set';

  const liftsLines = [];
  if (user.currentLifts?.bench) liftsLines.push(`Bench ${user.currentLifts.bench}lb`);
  if (user.currentLifts?.squat) liftsLines.push(`Squat ${user.currentLifts.squat}lb`);
  if (user.currentLifts?.deadlift) liftsLines.push(`Deadlift ${user.currentLifts.deadlift}lb`);
  if (user.currentLifts?.overheadPress) liftsLines.push(`Overhead press ${user.currentLifts.overheadPress}lb`);
  const currentLiftsStr = liftsLines.length ? liftsLines.join(' | ') : 'not provided';

  const equipStr = user.equipment ? user.equipment.replace(/_/g, ' ') : 'unknown';
  const daysStr = user.daysPerWeek ? `${user.daysPerWeek} days/week` : 'flexible schedule';

  let programContext = '';
  if (state && planDay) {
    const exerciseLines = planDay.exercises.map((ex) => {
      const details = [`${ex.sets}x${ex.reps}`];
      if (ex.loadLb > 0) details.push(`@ ${ex.loadLb}lb`);
      if (ex.rpeTarget != null) details.push(`RPE ${ex.rpeTarget}`);
      if (ex.restSeconds) details.push(`${ex.restSeconds}s rest`);
      const notes = ex.notes ? ` - ${ex.notes}` : '';
      return `${ex.name}: ${details.join(' ')}${notes}`;
    });

    const flagLines = formatActiveFlags(state.flags);

    programContext = `
CURRENT PROGRAM:
Program: ${state.programName || state.phase || 'Active program'}
Current week: ${state.currentMicrocycle ?? 'unknown'}
Current day index: ${state.currentDayIndex ?? 'unknown'}
Scheduled session: ${planDay.dayType || 'Training'} on ${planDay.plannedDate ? new Date(planDay.plannedDate).toDateString() : 'unscheduled'}
Exercises:
  ${exerciseLines.length ? exerciseLines.join('\n  ') : 'Rest day or no exercises assigned'}
Active flags: ${flagLines.length ? flagLines.join(', ') : 'none'}
`;
  } else if (state) {
    programContext = `
CURRENT PROGRAM:
Program: ${state.programName || state.phase || 'Active program'}
Current week: ${state.currentMicrocycle ?? 'unknown'}
No upcoming planned session found.
`;
  } else {
    programContext = `
CURRENT PROGRAM: none yet. Help the user get started from their goals, schedule, and available equipment.
`;
  }

  const sessionSummaries = lastThreeLogs.map((log) => {
    if (log.sessionType === 'missed') {
      return `${new Date(log.date).toDateString()} - Missed`;
    }
    const data = log.extractedData || {};
    const parts = [new Date(log.date).toDateString()];
    if (data.bench?.loadLb) parts.push(`Bench ${data.bench.loadLb}lb RPE ${data.bench.rpeReported ?? '?'}`);
    if (data.squat?.loadLb) parts.push(`Squat ${data.squat.loadLb}lb`);
    if (data.deadlift?.loadLb) parts.push(`Deadlift ${data.deadlift.loadLb}lb RPE ${data.deadlift.rpeReported ?? '?'}`);
    if (data.accessoriesDone?.length) parts.push(`Accessories: ${data.accessoriesDone.join(', ')}`);
    parts.push(`Felt: ${log.extractedData?.generalFeeling ?? 'N/A'}`);
    return parts.join(' - ');
  });

  return `You are IronLog - an elite training coach AI for ${user.name}.

ATHLETE:
${profileStr}
Goal: ${goalStr}
Experience: ${user.experienceLevel ?? 'not set'}
Equipment: ${equipStr}
Schedule: ${daysStr}
Current 1RMs: ${currentLiftsStr}
${user.injuries ? `Injuries/limitations: ${user.injuries}` : ''}
${programContext}
RECENT SESSIONS:
${sessionSummaries.length ? sessionSummaries.join('\n') : 'No sessions logged yet'}

YOUR ROLE:
- This is an ongoing conversation. The user can talk to you at any time about anything training-related.
- Be direct, no fluff. Max 3 sentences unless answering a substantive question.
- You remember everything from prior messages in this thread.

WHEN USER WANTS TO LOG A SESSION:
- Walk through what they did.
- Confirm exercise names, sets, reps, load, RPE when relevant, completion status, and any pain flags.
- Use the planned session above as the default exercise list, but accept substitutions or partial completion.
- Once you have enough info, summarize: "Here's what I'm logging:" then a bullet list, then "Sound right?"
- After they confirm, output the JSON inside <LOG_DATA>{...}</LOG_DATA> tags
- Then give one brief coaching note (max 2 sentences)

LOG_DATA SCHEMA:
{
  "sessionType": "completed | missed | partial",
  "missedReason": "string or null",
  "bench": { "setsCompleted": int, "repsPerSet": [array], "loadLb": int, "rpeReported": float, "notes": string },
  "squat": { "setsCompleted": int, "loadLb": int, "headacheGrade": 0|1|2|3, "notes": string },
  "deadlift": { "setsCompleted": int, "loadLb": int, "rpeReported": float, "notes": string },
  "accessoriesDone": ["list"],
  "painFlags": { "elbow": bool, "shoulder": bool, "lowerBack": bool, "other": string },
  "generalFeeling": "good | neutral | poor",
  "extraNotes": string
}
Use null for fields not mentioned.
For exercises that do not map cleanly to bench, squat, or deadlift, use accessoriesDone and extraNotes while preserving this schema.

WHEN USER WANTS A PROGRAM BUILT/CHANGED:
- Ask the minimum clarifying questions needed (days/week, equipment, focus lifts)
- Reference their stated goal and current 1RMs
- Don't generate the program yourself - say "I can set that up for you. Confirm and I'll build it." Then wait.

HARD RULES:
- Never give nutrition advice (weight, calories, food). Decline politely and stay in your lane.
- Never tell user to push through pain, dizziness, neurological symptoms, or injury signs.
- If the user reports severe or sudden symptoms, respond "Stop training immediately. Seek medical evaluation now." Then log the session as partial or missed as appropriate.
- Never modify the program without user confirming.`;
}

router.post('/', requireAuth, async (req, res) => {
  const { message, planDayId } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'EMPTY_MESSAGE' });

  let systemPrompt;
  try {
    systemPrompt = await buildSystemPrompt(req.userId, planDayId);
  } catch (err) {
    console.error('System prompt error:', err);
    return res.status(500).json({ error: 'AI_UNAVAILABLE' });
  }
  if (!systemPrompt) {
    return res.status(400).json({ error: 'USER_NOT_FOUND' });
  }

  const convo = await getOrCreateConversation(req.userId);
  const history = truncateHistoryToBudget(convo.messages, MAX_HISTORY_TOKENS);
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullReply = '';

  try {
    const stream = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: apiMessages,
      stream: true,
      max_tokens: 1024,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        fullReply += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    // Persist BOTH messages atomically
    try {
      const userMsg = { role: 'user', content: message, timestamp: new Date(), planDayId: planDayId ?? null };
      const aiMsg = { role: 'assistant', content: fullReply, timestamp: new Date(), planDayId: planDayId ?? null };
      await Conversation.findByIdAndUpdate(convo._id, {
        $push: { messages: { $each: [userMsg, aiMsg] } },
      });
    } catch (persistErr) {
      console.error('Failed to persist messages:', persistErr);
    }

    res.write('data: [DONE]\n\n');
  } catch (err) {
    const isRateLimit = err?.status === 429 || err?.error?.type === 'rate_limit_exceeded';
    res.write(`data: ${JSON.stringify({ error: isRateLimit ? 'RATE_LIMIT' : 'AI_UNAVAILABLE' })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
