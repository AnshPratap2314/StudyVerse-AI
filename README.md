# Smart Study AI Assistant — Integrated Team Build

A single integrated project combining three vertical slices with one shared AI core:

- **Person 1 — AI Core:** provider gateway, model routing, multi-agent orchestration, RAG, document ingestion, reviewer, memory and observability.
- **Person 2 — Learning System:** authentication, MongoDB models, dashboard, quizzes, flashcards, study plans, progress, analytics and tutor bridge.
- **Person 3 — Product & Integrations:** todos, Gmail, Google Calendar, research, study rooms/WebSockets, voice, educational videos, coding, interview and resume tools.

## What was fixed in the final integration

- Added a real **login/register gate** to the main application instead of leaving the core workspace anonymously accessible.
- All authenticated feature APIs now require the user's JWT server-side.
- Frontend API calls automatically attach the JWT and keep Google OAuth cookies.
- Todos are now stored by **account ID**, not a browser session, so they follow the user across devices.
- RAG documents and vector retrieval are **owner-scoped** so one user's documents are not returned to another user.
- Centralized AI model configuration so all Gemini slots use `GEMINI_MODEL` unless explicitly overridden.
- AI quota/rate-limit failures now stop pointless retries and automatically try configured fallback providers.
- Frontend no longer renders raw provider JSON errors; quota/network/auth errors are converted into useful messages.
- Rebuilt the frontend as a responsive application shell with mobile navigation, tablet layouts, compact controls and reduced-motion support.
- Added loading/disabled states to long-running actions to prevent duplicate requests.
- Added account-aware dashboard summary, logout, session validation and expired-session handling.
- Kept Gmail/Calendar OAuth, research, video search, study rooms, voice, coding, interview and resume workflows connected to the integrated backend.

## Architecture

```text
                           USER
                            |
                            v
                     LOGIN / REGISTER
                            |
                            v
                       FRONTEND APP
                            |
                            v
                      EXPRESS API
                            |
        +-------------------+--------------------+
        |                   |                    |
        v                   v                    v
   PERSON 1 AI         PERSON 2 LEARNING    PERSON 3 PRODUCT
   Gateway             Auth + MongoDB       Gmail/Calendar
   Router              Dashboard            Research
   Orchestrator        Quizzes              Todos
   Agents              Flashcards           Rooms/WebSocket
   RAG                  Planner              Voice
   Reviewer             Progress             Videos
   Memory               Analytics            Coding/Interview
        |                                      Resume
        +-------------------+--------------------+
                            |
                            v
                  Gemini / OpenAI / Groq
```

The shared AI contract is:

```text
POST /api/ai/chat
POST /api/ai/task
```

Person 2 and Person 3 consume the shared AI layer rather than creating independent Gemini/OpenAI implementations.

## Project layout

```text
Smart-Study-AI-Assistant-integrated/
├── Backend/
│   ├── server.cjs
│   ├── ai/                    # Person 2 bridge to Person 1 orchestrator
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── src/
│   │   ├── ai/                # providers + gateway + schemas
│   │   ├── agents/            # specialist agents
│   │   ├── documents/         # PDF/DOCX/PPTX/TXT/image extraction
│   │   ├── rag/               # chunking + owner-scoped vector retrieval
│   │   ├── memory/
│   │   ├── observability/
│   │   └── orchestrator.cjs
│   ├── tests/
│   ├── smokeTest.cjs
│   └── package.json
├── Frontend/
│   ├── index.html             # login + main application
│   ├── app.js
│   ├── style.css
│   └── dashboard.*
├── FINAL_QA_NOTES.md
└── README.md
```

## Run locally

Requirements:

- Node.js 20+ recommended
- npm
- MongoDB Atlas/local MongoDB for account and learning features
- At least one AI provider for AI features
- LibreOffice (`soffice`) only when legacy `.ppt` extraction is required

```bash
cd Backend
npm install
cp .env.example .env
npm run qa
npm start
```

The integrated project is configured for:

```text
http://localhost:5050
```

Open that URL in Safari, Chrome, Edge or another modern browser. Do **not** open `Frontend/index.html` directly with `file://`; the application is designed to run through the backend so authentication, CORS, cookies and WebSockets work consistently.

## Environment setup

### Required for login

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=long-random-secret
SESSION_SECRET=another-long-random-secret
PORT=5050
FRONTEND_ORIGINS=http://localhost:5050,http://127.0.0.1:5050
```

### Required for AI

Only one provider is required initially:

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-3.6-flash
```

Optional automatic fallbacks:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
GROQ_API_KEY=
GROQ_MODEL=
AI_FALLBACK_PROVIDERS=gemini,openai,groq
```

You do **not** need every API in `.env.example` to run the core application.

### Optional services

```env
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=smart_study_knowledge

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5050/api/google/callback

YOUTUBE_API_KEY=
```

- Qdrant is optional; local JSON vector storage is used when Qdrant is absent.
- Gmail/Calendar require Google OAuth credentials.
- YouTube API is optional; video search falls back to a normal YouTube search URL.

## Authentication behavior

The main app starts with:

```text
Login / Register
      |
      v
JWT issued by backend
      |
      v
Main Smart Study workspace
```

The frontend stores the access token locally and attaches:

```http
Authorization: Bearer <token>
```

Protected feature APIs reject anonymous requests. `/api/health` remains public for deployment health checks.

## AI behavior and quota handling

The AI gateway centralizes model selection and fallback handling.

```text
Request
  |
  v
Selected provider/model
  |
  +---- success --------------------> response
  |
  +---- quota/rate limit ----------> fallback provider
  |
  +---- other temporary failure ----> bounded retry/fallback
```

Quota errors are no longer retried repeatedly. If no configured fallback provider is available, the UI displays a clean explanation rather than dumping the provider's raw JSON error into the chat.

## Document/RAG isolation

Documents are stored with an `ownerId` and retrieval is filtered by that owner. This prevents authenticated users from retrieving another user's indexed documents.

Supported document inputs include:

- PDF
- DOCX
- PPTX
- PPT (requires LibreOffice)
- TXT
- Markdown
- CSV
- JSON
- Images

## API contracts

### Person 1 — AI Core

```text
POST /api/ai/chat
POST /api/ai/task
POST /api/documents/upload
POST /api/documents/ingest
GET  /api/documents
POST /api/rag/query
GET  /api/ai/status
POST /api/ai/test-models
GET  /api/memory
POST /api/memory
GET  /api/conversations
```

### Compatibility APIs

```text
POST /api/ask
POST /api/analysis
POST /api/upload
```

These remain for compatibility and route through the shared AI implementation.

### Person 2 — Learning

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
GET  /api/dashboard
GET/PUT /api/users/profile
GET/POST /api/quizzes
POST /api/quiz-attempts/:quizId
GET  /api/progress
GET  /api/analytics/overview
GET/POST /api/plans
POST /api/tutor/chat
```

### Person 3 — Product & Integrations

```text
GET/POST/PATCH/DELETE /api/todos
GET  /api/google/auth
GET  /api/gmail/messages
POST /api/gmail/send
GET/POST/DELETE /api/calendar/events
POST /api/research
GET  /api/videos
POST /api/coding/solve
POST /api/interview/question
POST /api/interview/evaluate
POST /api/resume/review
POST /api/study-plan
POST /api/rooms
WS   /ws
```

## Testing and regression

### Static/syntax QA

```bash
cd Backend
npm run qa
```

The final contract/regression suite contains **25 tests** covering:

- Person 1/2/3 integration
- authentication UI and JWT flow
- server-side protection of feature APIs
- frontend API contracts
- duplicate AI endpoint detection
- document upload contracts
- AI provider fallback/quota behavior
- RAG ownership isolation
- account-scoped productivity data
- signed session cookies
- OAuth redirect behavior
- Gmail scope restrictions
- CORS, rate limits and payload limits
- responsive frontend structure
- provider error handling
- required dependencies and scripts

### Live smoke test

After starting the backend:

```bash
npm run smoke
```

or:

```bash
TEST_URL=http://localhost:5050 npm run smoke
```

The smoke test checks public health/frontend availability and verifies that protected feature endpoints reject anonymous requests.

### Browser regression checklist

After login, test:

1. Register a new account.
2. Log out.
3. Log back in.
4. Refresh the browser while logged in.
5. Open the app on a narrow phone-sized viewport.
6. Open the mobile navigation.
7. Create, complete and delete a todo.
8. Send an AI chat message.
9. Trigger a deliberate AI provider error/quota response and confirm a friendly UI error.
10. Paste notes and generate a study pack.
11. Upload a valid PDF.
12. Upload an invalid file and confirm a useful validation error.
13. Create/join a study room.
14. Send room messages and edit shared notes.
15. Search videos with and without a YouTube API key.
16. Test coding, interview and resume tools.
17. Test Google OAuth only after Google credentials are configured.
18. Open `/dashboard.html` and confirm the same login token works.

## Deployment notes

- Never commit `.env` or real API keys.
- Use a persistent shared database/vector store for multi-instance production deployment.
- Register the exact deployed Google OAuth callback URL in Google Cloud.
- Browser microphone features require HTTPS or localhost.
- WebSockets require the deployed host/proxy to support WebSocket upgrades.
- Keep `FRONTEND_ORIGINS` restricted to your real frontend origins in production.

## Expanded feature set

The integrated build now includes:

- Password reset flow with expiring reset tokens (development can expose the token in the UI; production should connect an email provider).
- Six explicit AI tutor modes: beginner, normal, Socratic, exam, interview and revision.
- Adaptive study planning using exam date, subjects, available hours and weak topics.
- Email triage that classifies/summarizes mail, extracts tasks/deadlines and can create Calendar events.
- Persistent reminders plus browser notification polling.
- Shared study-room documents, shared AI-generated quizzes and room AI tutor.
- AI-generated interactive educational lessons with slide/storyboard structure and browser TTS narration.
- Code RAG context for the coding assistant and an opt-in local code runner (`ENABLE_CODE_EXECUTION=true`).
- Multimodal Study AI chat: attach an image and ask the LLM to explain, solve or summarize it.
- Cost-aware model routing with provider pricing estimates and usage accounting.
- Refined responsive UI for desktop, tablet and mobile.

### Security note
The code runner is intentionally disabled by default. Do not expose arbitrary code execution on a public deployment without a hardened sandbox/container isolation layer.

## Study workspace

The learning area is intentionally split into AI Tutor, Study Packs, Flashcards and Quizzes. Generated cards and quizzes are persisted to the authenticated account, flashcards use spaced repetition, and quiz answers are evaluated server-side.
