# IronLog — Build Plan

**Read CLAUDE.md first.** This file is the task board. CLAUDE.md is the architecture reference.

Both files live at the root of `C:\Users\theof\ironlog-mobile`.

---

## What's Already Built (Do Not Rebuild)

| Piece | Location | State |
|---|---|---|
| Auth (signup/login/JWT/token storage) | `server/routes/auth.js`, `store/authStore.ts`, `app/(auth)/` | Complete |
| AI streaming chat (Groq llama-3.3-70b) | `server/routes/chat.js`, `app/(tabs)/index.tsx` | Complete |
| Conversation persistence | `server/models/Conversation.js`, `server/routes/conversations.js` | Complete |
| Workout log (POST session from chat) | `server/routes/log.js`, `server/models/Log.js` | Complete |
| Medical flags system | `server/engine/adaptations.js`, `server/routes/adaptations.js` | Complete |
| Keep-alive (prevents Render cold-start) | `hooks/useKeepAlive.ts` | Complete |
| User model (goal/equipment/lifts schema) | `server/models/User.js` | Complete — schema is ready for general programs |
| Plan model (generic sessions) | `server/models/Plan.js` | Complete — not Smolov-specific |
| EAS build config | `eas.json` | Configured |
| Render deployment | `https://ironlog-jkuj.onrender.com` | Live (free tier, sleeps after 15 min) |
| MongoDB Atlas | `cluster0.efqnhws.mongodb.net` | Live |

---

## What's Broken/Hardcoded (The Problem)

The backend ignores the user's actual profile and always generates a **Smolov Jr Bench Press** program regardless of goal or equipment. Specifically:

- `server/routes/setup.js` — reads `BENCH_LOADS`, `SQUAT_LOADS`, `DEADLIFT_LOADS` from `server/data/program.js` and generates 24 fixed sessions
- `server/models/ProgramState.js` — has `phase: 'smolov_jr_bench'` hardcoded as default
- `server/routes/chat.js` (`buildSystemPrompt`) — references headache grading and bench-specific flags, not appropriate for general users
- `app/setup.tsx` — says "Smolov Jr Bench Specialization" in the UI title

The User model schema already has `primaryGoal`, `experienceLevel`, `daysPerWeek`, `equipment`, `currentLifts` — the fields are there, they just aren't used.

---

## Agent Roles

| Role | Owns | Does NOT touch |
|---|---|---|
| **backend-agent** | `server/` directory | `app/` screens, `store/`, `api/`, `components/` |
| **frontend-agent** | `app/`, `store/`, `api/`, `components/` | `server/` |
| **human** | Credentials, app store accounts, RevenueCat setup, EAS builds | — |

**Shared boundary** — `API_CONTRACT.md` (defined below in this file). When backend-agent adds a new endpoint or changes a response shape, it updates the contract section. Frontend-agent reads it before building UI. Both agents commit to `master` on the same repo.

---

## API Contract (Shared Boundary)

Backend-agent maintains this. Frontend-agent reads it before building screens.

### Existing endpoints (stable — do not break)

```
POST /api/auth/signup        { email, password, name } → { token, user }
POST /api/auth/login         { email, password } → { token, user }
GET  /api/auth/me            → user object
POST /api/auth/onboarding-complete → { success }
POST /api/setup              { startDate } → { success } | { alreadyInitialized }
GET  /api/state              → ProgramState
GET  /api/plan/today         → Plan | null
GET  /api/plan               → Plan[]
POST /api/chat               { message, planDayId? } → SSE stream
POST /api/log                { planDayId, extractedData, sessionType } → { log }
GET  /api/conversations      { limit? } → { messages[] }
GET  /api/health             → { status, timestamp }
GET  /ping                   → { ok, ts }
```

### New endpoints (added in this build — backend-agent defines shape here when built)

```
GET  /api/exercises          { muscle?, equipment?, limit? } -> Exercise[]
GET  /api/exercises/search   { q, limit? } -> Exercise[]
POST /api/setup              { startDate? | programStartDate? } -> { success, programName } | { alreadyInitialized }
GET  /api/state              CHANGED - includes { initialized, programName, missedSessionCount }
GET  /api/progress           PRO - { lift, from?, to? } -> { lift, points: [{date, e1rm, loadLb, reps}] }
POST /api/replan             PRO - { missedPlanIds?, reason } -> { diffToken, diff: { summary, removed[], rescheduled[], added[] } }
POST /api/replan/confirm     { diffToken } -> { success }
GET  /api/subscription/status -> { isPro, expiresAt }
```

---

## Phase 1 — General Program Engine
**Goal:** Replace Smolov Jr hardcoding. Any user gets a real program that matches their goal, equipment, and schedule.
**Blocks everything else.** Do this first.

---

### P1-001 — Import exercise database
**Owner:** backend-agent
**Priority:** P0
**Deps:** none

**What to build:**
Create `server/data/import-exercises.js` — a one-time script that fetches exercise data from the free Wrkout dataset (public domain, no license issues) and seeds MongoDB.

Create `server/models/Exercise.js`:
```js
{
  name: String,           // "Barbell Back Squat"
  aliases: [String],      // ["back squat", "squat"]
  primaryMuscle: String,  // "quadriceps"
  secondaryMuscles: [String],
  equipment: String,      // "barbell" | "dumbbell" | "bodyweight" | "cable" | "machine"
  category: String,       // "compound" | "isolation" | "cardio"
  instructions: String,
  difficulty: String,     // "beginner" | "intermediate" | "advanced"
}
```

Create `server/routes/exercises.js`:
- `GET /api/exercises?muscle=chest&equipment=barbell&limit=20` → `Exercise[]`
- `GET /api/exercises/search?q=squat` → `Exercise[]`

Register in `server/server.js`.

**Acceptance criteria:**
- 500+ exercises in MongoDB after running the import script
- `GET /api/exercises?equipment=bodyweight` returns bodyweight exercises only
- `GET /api/exercises/search?q=press` returns bench press, overhead press, etc.

**Note:** Use the Wrkout dataset from `https://github.com/wrkout/exercises.json` — public domain. Fetch it in the script, parse, and insert. No API key needed.

---

### P1-002 — AI-based program generator (replaces Smolov Jr)
**Owner:** backend-agent
**Priority:** P0
**Deps:** P1-001

**Context:** `server/routes/setup.js` currently reads hardcoded loads from `server/data/program.js` and generates 24 Smolov Jr sessions. Replace the generation logic entirely.

**What to change:**

`server/routes/setup.js` — new logic:
1. Read the authenticated user's full profile: `primaryGoal`, `experienceLevel`, `daysPerWeek`, `equipment`, `currentLifts`, `injuries`
2. Call Groq (`llama-3.3-70b-versatile`) with a structured prompt asking it to generate a 4-week program
3. Force JSON output via `response_format: { type: 'json_object' }` with this schema:

```json
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
}
```

4. Convert `loadPercent` to absolute lb using `user.currentLifts` (if provided) OR leave as 0 for AI coach to guide
5. Insert all sessions as `Plan` documents (same schema as before)
6. Update `ProgramState.phase` to `programName` (not hardcoded 'smolov_jr_bench')

**System prompt for generation (put in a helper function, not inline):**
```
You are a certified strength and conditioning coach. Generate a personalized training program.

User profile:
- Goal: {primaryGoal}
- Experience: {experienceLevel}
- Equipment: {equipment}
- Days per week: {daysPerWeek}
- Current lifts (lb): {currentLifts or "not provided"}
- Injuries/limitations: {injuries or "none"}

Rules:
- Match equipment strictly (never prescribe barbell exercises for "bodyweight" users)
- Match experience (beginners: 3x8-12 compounds; advanced: periodized with RPE)
- Match goal (strength: low rep high intensity; hypertrophy: moderate rep ranges; weight_loss: circuit-style)
- Include rest days
- Do NOT generate more than {daysPerWeek} training days per week
- Use only exercises the user can do with their equipment
- loadPercent is % of 1RM if currentLifts provided, else 0
```

**Update `server/models/ProgramState.js`:**
- Remove `benchTrainingMax`, `squatTrainingMax`, `deadliftTrainingMax` defaults
- Remove hardcoded `phase: 'smolov_jr_bench'` default
- Add `programName: String`

**Do NOT touch** `server/data/program.js` — keep it for reference/rollback. Just stop importing it in setup.js.

**Acceptance criteria:**
- User with `goal=hypertrophy, equipment=dumbbells_only, daysPerWeek=3` gets a 3-day dumbbell hypertrophy program
- User with `goal=strength, equipment=full_gym, daysPerWeek=5` gets a 5-day strength program
- `ProgramState.phase` reflects the generated program name, not 'smolov_jr_bench'
- If `currentLifts` are provided, `Plan.exercises[].loadLb` is populated; otherwise 0

---

### P1-003 — Generalize the AI system prompt
**Owner:** backend-agent
**Priority:** P0
**Deps:** P1-002

**File:** `server/routes/chat.js` — `buildSystemPrompt()` function

**What to change:**
The current system prompt hardcodes Smolov Jr phases, headache grading scales, and bench-specific flags. Replace with a general prompt that works for any program.

Keep these parts:
- User profile block (age, weight, experience, goal, equipment, current lifts) — already generic
- LOG_DATA schema — already generic
- Recent sessions summary — already generic
- Hard rules (no nutrition, no pushing through pain)

Replace these parts:
- Remove all references to "Smolov Jr", "microcycle 1/2/3", "bench specialization"
- Replace headache grade scale with general pain flags
- Replace `state.phase` hardcoded bench flags with generic flag display
- Current program block: use `programState.programName` + today's session exercises

**Acceptance criteria:**
- A hypertrophy user's chat prompt does not mention bench specialization or headache grades
- A strength user's prompt correctly shows their current week and today's exercises
- The LOG_DATA schema output still works (same format, just different exercise names)

---

### P1-004 — Fix setup.tsx UI (remove Smolov Jr references)
**Owner:** frontend-agent
**Priority:** P0
**Deps:** P1-002

**File:** `app/setup.tsx`

**What to change:**
- Remove "Smolov Jr Bench Specialization" title and description
- Replace with: "Your Program" / "We'll build your first program based on your profile."
- Remove the bullet points listing Smolov-specific details
- Keep the date picker (start date is still needed)
- The `POST /api/setup` call stays the same — just remove the hardcoded description text

**Acceptance criteria:**
- `app/setup.tsx` contains no references to Smolov Jr
- The screen still successfully calls `POST /api/setup` and routes to `/(tabs)` on success

---

## Phase 2 — Fix My Week (Core Differentiator)
**Goal:** When a user misses a session, the AI restructures the remaining week. This is the feature that nobody else has. Do not skip this.

---

### P2-001 — Missed session detection
**Owner:** backend-agent
**Priority:** P0
**Deps:** P1-002

**File:** `server/routes/state.js`

When `GET /api/state` is called, check if any `Plan` documents for this user have:
- `status: 'planned'`
- `plannedDate < now - 12 hours` (give a half-day grace)

For each one found, mark as `status: 'missed'`.

Return the count of missed sessions in the state response:
```json
{
  "currentMicrocycle": 1,
  "programName": "...",
  "flags": { ... },
  "missedSessionCount": 2
}
```

**Acceptance criteria:**
- If a planned session date passed 12+ hours ago with no log, state returns `missedSessionCount > 0`
- Missed plans are marked `status: 'missed'` in MongoDB

---

### P2-002 — Replan endpoint
**Owner:** backend-agent
**Priority:** P0
**Deps:** P2-001

**Create:** `server/routes/replan.js`

```
POST /api/replan
Body: { reason: string, missedPlanIds: string[] }
Response: {
  diffToken: string,
  diff: {
    summary: string,
    removed: [{ _id, date, dayType }],
    rescheduled: [{ _id, oldDate, newDate, dayType }],
    added: [{ date, dayType, exercises[] }]
  }
}

POST /api/replan/confirm
Body: { diffToken: string }
Response: { success: true }
```

**Logic for `POST /api/replan`:**
1. Get user's remaining unfinished `Plan` documents (status: planned or missed)
2. Call Groq with the user's profile + remaining sessions + missed sessions + reason
3. Ask it to return a JSON restructured schedule (which sessions to move, which to drop, how to compress the week)
4. Build a diff object — what changed vs original
5. Generate a `diffToken` (UUID, store in memory or Redis for 10 min — simple Map is fine for v1)
6. Return the diff — do NOT apply it yet

**Logic for `POST /api/replan/confirm`:**
1. Look up `diffToken`
2. Apply the changes to the Plan documents
3. Return success

**Why two steps:** User reviews the diff card in the app before confirming. The AI proposes, the human approves. This is the core "diff card" mechanic from the market research.

**Register in `server/server.js`.**

**Acceptance criteria:**
- `POST /api/replan` with reason "knee pain" returns a diff that drops leg day sessions
- `POST /api/replan/confirm` with the token actually updates Plan documents in MongoDB
- Calling confirm twice with the same token fails (token consumed)

---

### P2-003 — "Fix My Week" UI
**Owner:** frontend-agent
**Priority:** P0
**Deps:** P2-002

**Files to modify:** `app/(tabs)/today.tsx`
**Files to create:** `components/ReplanDiffCard.tsx`

**What to build in `today.tsx`:**
- If `programState.missedSessionCount > 0`, show a banner: "You missed {n} session(s). Fix your week?"
- Tapping it opens a modal with a reason input ("What got in the way?") and a "See options" button
- On submit: call `POST /api/replan` → shows `ReplanDiffCard`

**`ReplanDiffCard.tsx` component:**
```
Props: { diff, onConfirm, onDecline, loading }
```
Shows:
- Summary line from `diff.summary` (AI-generated plain English)
- List of rescheduled sessions (old date → new date)
- List of dropped sessions (if any)
- "Apply changes" button → calls `POST /api/replan/confirm`
- "Keep original plan" button → dismisses

**Acceptance criteria:**
- Missed session banner appears in Today tab when `missedSessionCount > 0`
- Entering a reason and confirming shows the diff card
- Tapping "Apply changes" updates the plan and banner disappears
- Tapping "Keep original plan" dismisses without changes

---

## Phase 3 — Progress & Analytics
**Goal:** Users see their progress. This is the #2 reason users pay.

---

### P3-001 — e1RM progress endpoint
**Owner:** backend-agent
**Priority:** P1
**Deps:** P1-001

**Create:** `server/routes/progress.js`

```
GET /api/progress?lift=bench&from=2026-01-01&to=2026-12-31
Response: {
  lift: "bench",
  points: [
    { date: "2026-04-01", e1rm: 245, loadLb: 225, reps: 5 }
  ]
}
```

**e1RM formula:** `load × (1 + reps / 30)` (Epley formula, standard)

Query `Log` documents for exercises matching the lift name, extract weight and reps, calculate e1RM per session, return time series.

**Register in `server/server.js`.**

**Acceptance criteria:**
- `GET /api/progress?lift=bench` returns a time-series array sorted by date
- e1RM is calculated correctly (225lb × 5 reps = 262lb e1RM)
- Returns empty array if no logs exist (not an error)

---

### P3-002 — Progress charts UI
**Owner:** frontend-agent
**Priority:** P1
**Deps:** P3-001

**File:** `app/(tabs)/history.tsx`

`react-native-gifted-charts` is already installed. Use `LineChart` component.

**What to build:**
- Lift selector (Bench / Squat / Deadlift / OHP — tabs or dropdown)
- e1RM trend line chart (last 90 days by default)
- Below chart: scrollable list of past sessions (date, exercise, sets×reps@weight)

**Acceptance criteria:**
- History tab shows an e1RM chart for the selected lift
- Chart updates when switching between lifts
- Empty state shows "No sessions logged yet" for new users

---

## Phase 4 — Monetization
**Goal:** Free tier works fully. Pro ($7.99/mo) gates: unlimited replan, advanced analytics. Aim to implement before public launch.

---

### P4-001 — Pro gate middleware
**Owner:** backend-agent
**Priority:** P1
**Deps:** none

**File:** `server/middleware/proGate.js`

```js
export function requirePro(req, res, next) {
  // check req.user.isPro — set during requireAuth
  if (!req.isPro) return res.status(403).json({ error: 'PRO_REQUIRED', upgradeUrl: 'ironlog://upgrade' })
  next()
}
```

Add `isPro: { type: Boolean, default: false }` to `server/models/User.js`.

Gate these endpoints with `requirePro`:
- `POST /api/replan` (Fix My Week is Pro only)
- `GET /api/progress` (advanced analytics is Pro only — basic chart is free)

Add `GET /api/subscription/status` → `{ isPro: bool, expiresAt: date | null }`

**Acceptance criteria:**
- Free user calling `POST /api/replan` gets 403 with `PRO_REQUIRED` error
- Setting `user.isPro = true` in MongoDB unlocks the endpoint

---

### P4-002 — RevenueCat integration
**Owner:** frontend-agent + human
**Priority:** P1
**Deps:** P4-001

**Human prerequisites:**
1. Create RevenueCat account at revenuecat.com (free for <$10k MRR)
2. Create "Pro Monthly" product at $7.99/mo in Play Console → link to RevenueCat
3. Get RevenueCat API key (public SDK key)

**Frontend-agent builds:**
Install: `npx expo install react-native-purchases`

Create `store/subscriptionStore.ts`:
- `initialize(apiKey)` — call on app start
- `purchasePro()` — triggers purchase flow
- `restorePurchases()`
- `isPro: boolean` — synced from RevenueCat

Create `components/UpgradeModal.tsx`:
- Shown when user hits a Pro-gated feature
- Shows feature list + $7.99/mo price
- "Start 7-day free trial" button → calls `purchasePro()`

In `store/authStore.ts`: after successful purchase, call `POST /api/subscription/sync` to update `user.isPro` on the server.

Add `POST /api/subscription/sync` in backend (validates receipt with RevenueCat webhook or SDK, sets `user.isPro`).

**Acceptance criteria:**
- Free user tapping "Fix My Week" sees UpgradeModal
- Completing purchase sets `isPro = true` both locally and on server
- Restoring purchases re-unlocks Pro features

---

## Phase 5 — Launch Prep
**Goal:** App passes Play Store review and has enough polish for real users.

---

### P5-001 — Rest timer
**Owner:** frontend-agent
**Priority:** P1
**Deps:** none

When user confirms a session log in chat (taps "Save Session"), auto-start a rest timer.
Default: 90 seconds. Show as a subtle countdown banner at the top of the chat screen.
Tap to dismiss early. Uses `setInterval` — no new packages needed.

---

### P5-002 — Offline tolerance
**Owner:** frontend-agent
**Priority:** P1
**Deps:** none

**File:** `api/index.ts`

If `POST /api/chat` fails (no network), queue the message in AsyncStorage and retry when connection returns. Show "Sending when back online..." in the message bubble.

This prevents data loss if user is in a gym with bad WiFi.

---

### P5-003 — Play Store listing
**Owner:** human
**Priority:** P1

Reference `PLAY_STORE_LISTING.md` in `C:\AI-Factory\repos\ironlog-main\` for copy.

Needed:
- 8 screenshots (1080×1920 or 1080×2340): login, today's workout, chat logging a session, dashboard, fix my week, progress chart, onboarding, upgrade screen
- Feature graphic (1024×500)
- Short description (80 chars): "AI coach that adapts when life ruins your schedule"
- Full description (4000 chars max)
- Privacy policy URL (PRIVACY.md content — host on GitHub Pages)

---

### P5-004 — Upgrade Render to paid tier
**Owner:** human
**Priority:** P1

Render free tier sleeps after 15 min. `useKeepAlive` prevents this while the app is open but the FIRST request after a long gap is still slow (~30s cold start). Upgrade to **Render Starter ($7/mo)** before public launch — no cold starts.

---

## Phase 6 — Post-Launch (Do Not Build Before Launch)

These are real but not launch blockers. Build after you have 50+ real users.

| ID | Feature | Why wait |
|---|---|---|
| P6-001 | Voice mode (Whisper API) | Complex, need user feedback first |
| P6-002 | Apple HealthKit / Google Fit sync | Requires Apple developer account |
| P6-003 | Multiple concurrent programs | Need to understand user patterns first |
| P6-004 | Plate calculator | P1, but not core |
| P6-005 | Social / sharing | Market research says skip v1 |
| P6-006 | iOS build | Need Apple developer account ($99/yr) |

---

## What to Never Build

Per market research and product decisions — these are locked:

- **Nutrition tracking** — out of scope, creates liability, not our model
- **Human coaching** — we are the AI coach, not a marketplace
- **Live workout streaming** — wrong product category
- **Social feed** — market research explicitly says skip v1

---

## Task Status

Update status here as work progresses.

| ID | Title | Owner | Status |
|---|---|---|---|
| P1-001 | Import exercise database | backend-agent | `done` |
| P1-002 | AI-based program generator | backend-agent | `done` |
| P1-003 | Generalize AI system prompt | backend-agent | `done` |
| P1-004 | Fix setup.tsx UI | frontend-agent | `ready` |
| P2-001 | Missed session detection | backend-agent | `done` |
| P2-002 | Replan endpoint | backend-agent | `done` |
| P2-003 | Fix My Week UI | frontend-agent | `blocked by P2-002` |
| P3-001 | e1RM progress endpoint | backend-agent | `done` |
| P3-002 | Progress charts UI | frontend-agent | `blocked by P3-001` |
| P4-001 | Pro gate middleware | backend-agent | `done` |
| P4-002 | RevenueCat integration | frontend-agent + human | `blocked by human: RevenueCat account` |
| P5-001 | Rest timer | frontend-agent | `ready` |
| P5-002 | Offline tolerance | frontend-agent | `ready` |
| P5-003 | Play Store listing | human | `ready` |
| P5-004 | Upgrade Render | human | `ready` |

---

## Handoff Queue

*(Write here when you need the other agent to act. Cross off when done.)*

- [ ] **[backend → frontend]** When P1-002 is done, confirm the exact shape of `GET /api/state` response (specifically `programName` and `missedSessionCount` fields) so frontend-agent can update `store/appStore.ts` and `app/(tabs)/today.tsx`.
- [ ] **[backend → frontend]** When P2-002 is done, confirm `diffToken` TTL so frontend knows how long the diff card remains valid.
- [ ] **[human → agents]** Provide RevenueCat public SDK key to unblock P4-002.

Backend summary: P1-001 through P4-001 backend work is implemented and committed: exercises are imported/searchable, setup now calls Groq for a profile-based 4-week program, chat prompt context is generalized, overdue planned sessions become missed on `GET /api/state`, replan diff/confirm endpoints exist with 10-minute in-memory tokens, e1RM progress returns sorted points, and Pro gating plus subscription status are wired. Manual endpoint checks passed for exercise search, missed-session detection, e1RM calculation, and Pro 403/unlock behavior; AI setup/replan calls reached Groq but failed because the current `server/.env` Groq key returns `invalid_api_key`, so a valid `GROQ_API_KEY` is needed for full acceptance. Frontend-agent should expect `GET /api/state` to include `programName` and `missedSessionCount`, handle `PRO_REQUIRED` on `POST /api/replan` and `GET /api/progress`, and treat `diffToken` as expiring after 10 minutes.
