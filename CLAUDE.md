# IronLog — Single Source of Truth

**Standalone project. No dependency on AI Factory, SW Copilot, or any other repo.**

Read this entire file before touching any code. Update it when you complete, break, or discover something.

---

## What This Is

A mobile-first AI training coach for powerlifting-focused lifters.

**Core loop**: Onboard → AI chat logs sessions conversationally → adaptive program adjusts based on performance and flags.

**What the AI does**: Understands what you lifted, extracts structured log data from natural language, tracks pain/fatigue flags, and advises on program adjustments. The LLM (Groq llama-3.3-70b) is the conversational layer — the program logic (loads, microcycles, adaptations) is deterministic server code.

**Current program**: Smolov Jr Bench Press specialization — 3 microcycles × 8 days = 24 sessions of hardcoded progressive overload loads. Squat and deadlift are accessory tracking only.

---

## Stack

**Mobile**: React Native 0.81, Expo SDK 54, TypeScript, Expo Router v6, Zustand, AsyncStorage

**Backend**: Node.js (ESM), Express, MongoDB (Mongoose), Groq SDK, JWT auth

**Infrastructure**: Render (server), MongoDB Atlas (free tier M0), EAS (builds)

---

## Repo Layout

```
ironlog-mobile/              ← this repo root (git)
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx     ← auth stack
│   │   ├── login.tsx       ← login screen
│   │   └── signup.tsx      ← signup screen
│   ├── (tabs)/
│   │   ├── _layout.tsx     ← tab bar (Chat, Today, History, Flags)
│   │   ├── index.tsx       ← CHAT — main AI coach chat with streaming
│   │   ├── today.tsx       ← TODAY — today's session / rest day
│   │   ├── history.tsx     ← LOG HISTORY
│   │   └── flags.tsx       ← MEDICAL FLAGS view
│   ├── onboarding.tsx      ← profile setup (age, weight, 1RMs, goal, equipment)
│   ├── setup.tsx           ← modal: initialize Smolov Jr program
│   └── _layout.tsx         ← root layout: auth guard, hydrate, keep-alive
├── components/
│   └── LLMConsentGate.tsx  ← GDPR-style consent before first AI message
├── store/
│   ├── authStore.ts        ← user auth state: hydrate, login, signup, logout, setOnboardingComplete
│   └── appStore.ts         ← program state + today's plan
├── api/
│   └── index.ts            ← axios client + token management + streamChat()
├── hooks/
│   └── useKeepAlive.ts     ← pings /ping every 13 min to prevent Render cold-start
├── assets/
│   ├── icon.png
│   ├── splash-icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
├── server/                 ← Express backend (run separately)
│   ├── routes/
│   │   ├── auth.js         ← signup, login, /me, onboarding-complete
│   │   ├── chat.js         ← CORE: Groq streaming AI coach, LOG_DATA extraction
│   │   ├── setup.js        ← initializes Smolov Jr program for user (one-time)
│   │   ├── state.js        ← GET current program state + flags
│   │   ├── plan.js         ← GET all plans, GET today's plan
│   │   ├── log.js          ← POST session log (extracted from chat)
│   │   ├── logs.js         ← GET log history
│   │   ├── adaptations.js  ← trigger adaptation engine
│   │   ├── medicalClearance.js
│   │   ├── painSeverity.js
│   │   └── conversations.js ← GET/clear chat history
│   ├── models/
│   │   ├── User.js         ← profile: lifts, goals, equipment, onboardingComplete
│   │   ├── ProgramState.js ← microcycle, dayIndex, flags
│   │   ├── Plan.js         ← 24 pre-generated session documents
│   │   ├── Log.js          ← completed session records
│   │   ├── Conversation.js ← persisted chat messages
│   │   └── Adaptation.js
│   ├── engine/
│   │   └── adaptations.js  ← deterministic adaptation logic (252 lines)
│   ├── data/
│   │   └── program.js      ← Smolov Jr loads by microcycle + day templates
│   ├── middleware/
│   │   └── auth.js         ← JWT requireAuth middleware
│   ├── server.js           ← Express entry point (59 lines, imports all routes)
│   ├── package.json        ← ESM, node server.js
│   ├── .env                ← GITIGNORED — see .env.example
│   └── .env.example
├── app.json                ← bundle: com.siddhantgawad.ironlog, apiBaseUrl: Render URL
├── eas.json                ← EAS builds: development, preview (APK), production (AAB)
└── .gitignore
```

---

## Running Locally

**Backend:**
```bash
cd server
npm install        # only first time, node_modules already present
node server.js     # runs on port 3001
```

**Mobile app:**
```bash
# root of this repo
npm install        # only first time
npm start          # expo dev server
# press 'a' for Android emulator, scan QR for Expo Go
```

The app points to `https://ironlog-jkuj.onrender.com` by default (set in `app.json extra.apiBaseUrl`). To use local server, change that to `http://10.0.2.2:3001` (Android emulator) or `http://localhost:3001` (iOS simulator).

---

## Infrastructure

| Service | URL / Location | Status |
|---------|----------------|--------|
| Mobile app (EAS) | Project ID: `95e907b0-fa61-409c-b246-ed513f528e4b` | configured |
| Backend (Render) | `https://ironlog-jkuj.onrender.com` | deployed, free tier (sleeps after 15 min inactivity — useKeepAlive prevents this while app is open) |
| MongoDB Atlas | cluster0.efqnhws.mongodb.net | live, M0 free tier |
| Groq | llama-3.3-70b-versatile | live, free tier |

**Render env vars to set in dashboard** (never commit these):
- `MONGO_URI`
- `GROQ_API_KEY`
- `PORT=3001`
- `CLIENT_URL=*` (or mobile app URL)

---

## Auth Flow

1. App launches → `authStore.hydrate()` checks AsyncStorage for JWT token
2. No token → redirect to `/(auth)/login`
3. Login/signup → token saved to AsyncStorage
4. `user.onboardingComplete === false` → redirect to `/onboarding`
5. After onboarding → `POST /api/setup` generates 24 Smolov Jr sessions → redirect to `/(tabs)`

---

## AI Chat Architecture

`app/(tabs)/index.tsx` → `streamChat()` in `api/index.ts` → `POST /api/chat` (SSE stream)

Server-side (`server/routes/chat.js`):
1. Builds system prompt from: user profile + current program state + today's plan + last 3 session logs
2. Fetches conversation history (capped at 6000 token budget)
3. Streams response from Groq llama-3.3-70b
4. Persists both user message and AI reply to `Conversation` model
5. AI embeds `<LOG_DATA>{...}</LOG_DATA>` when it has enough info to log a session
6. App parses `LOG_DATA`, shows "Save Session" confirm card, user taps → `POST /api/log`

---

## Build for Android

```bash
# Install EAS CLI if needed
npm install -g eas-cli

# Preview APK (for testing, sideload)
eas build --platform android --profile preview

# Production AAB (for Play Store)
eas build --platform android --profile production
```

Play Store submit config already in `eas.json`. Needs `google-play-key.json` (service account) in repo root.

---

## What Still Needs Work

- [ ] Render free tier cold-start: useKeepAlive works while app is open, but first load after a long gap is still slow. Consider upgrading to Render Starter ($7/mo) before public launch.
- [ ] Program flexibility: current setup only supports Smolov Jr. If you want to expand to other programs, `server/data/program.js` and `server/routes/setup.js` are the files to extend.
- [ ] RevenueCat subscription gate: no payment integration yet. Pro features are not gated.
- [ ] Play Store listing: `PLAY_STORE_LISTING.md` exists in the old repo — use it as a reference.
- [ ] iOS: `eas.json` has iOS config but Apple developer account needed. Android only for now.

---

## Hard Rules

- Never commit `.env` or `server/.env`
- Never modify program loads in `server/data/program.js` without user approval — those numbers are the product
- Never add nutrition advice to the AI system prompt — out of scope by design
- Server is ESM (`"type": "module"`) — use `import`, not `require`
- The AI never modifies the program without explicit user confirmation in chat

---

## Handoff Queue

*(Write here when you need action from user or another agent)*
