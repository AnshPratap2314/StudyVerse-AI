# StudyVerse AI

> An AI-powered study assistant that helps students learn, practice, research, and prepare for exams in one place.

StudyVerse AI is a full-stack AI learning platform designed to bring study, productivity, research, and career-preparation tools into a single application.

## ✨ Features

### 🤖 AI Study Assistant
- AI chat for study-related questions
- Multiple AI tutor modes
- Beginner-friendly explanations
- Exam preparation
- Socratic learning
- Revision assistance
- Interview preparation
- Context-aware conversations
- AI memory

### 📚 Study Tools
- Study Pack generation
- Notes summarization
- Flashcard generation
- AI-generated quizzes
- Mind maps
- Study plans
- Progress tracking
- Learning analytics
- Spaced repetition
- Adaptive learning

### 📄 Document Analysis
Supported inputs include:
- PDF
- DOCX
- PPTX
- PPT
- TXT
- Markdown
- CSV
- JSON
- Images

The document system extracts content, creates searchable chunks, and supports RAG-based question answering.

### 🔎 AI Research
- AI-assisted research
- Structured research responses
- Educational resource discovery
- Video search
- Research context for study workflows

### 🎯 Productivity
- Todos
- Reminders
- Browser notifications
- Study planning
- Gmail integration
- Google Calendar integration

### 👥 Study Rooms
- Create and join study rooms
- Real-time messaging
- Shared notes
- Shared quizzes
- Room AI tutor
- WebSocket communication

### 💻 Developer Tools
- AI coding assistant
- Code explanations
- Code problem solving
- Code RAG context
- Optional local code execution

### 🧑‍💼 Career Preparation
- Interview question generation
- Interview answer evaluation
- Resume review
- Technical interview preparation

### 🎙️ Voice & Multimedia
- Voice interaction
- Text-to-speech
- Educational video search
- AI-generated interactive lessons
- Image-based AI questions

## 🏗️ Architecture

```text
                         ┌───────────────┐
                         │     USER      │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ Login/Register│
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │  Frontend App │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │  Express API  │
                         └───────┬───────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
   │   AI Core   │       │  Learning   │       │ Integrations│
   │             │       │   System    │       │ & Product   │
   ├─────────────┤       ├─────────────┤       ├─────────────┤
   │ AI Gateway  │       │ Auth        │       │ Gmail       │
   │ Orchestrator│       │ Dashboard   │       │ Calendar    │
   │ Agents      │       │ Quizzes     │       │ Research    │
   │ RAG         │       │ Flashcards  │       │ Todos       │
   │ Memory      │       │ Analytics   │       │ Study Rooms │
   │ Documents   │       │ Study Plans │       │ Voice       │
   └──────┬──────┘       └─────────────┘       │ Coding      │
          │                                      │ Interview   │
          │                                      │ Resume      │
          │                                      └─────────────┘
          │
          ▼
   ┌─────────────────────────────┐
   │ Gemini / OpenAI / Groq     │
   └─────────────────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript
- Responsive UI
- WebSocket client
- Browser Web APIs

### Backend
- Node.js
- Express.js
- REST APIs
- WebSockets
- JWT Authentication
- MongoDB

### AI
- Google Gemini
- OpenAI
- Groq
- AI provider gateway
- Model routing
- Multi-agent orchestration
- RAG
- AI memory
- Prompt-based workflows

### Document Processing
- PDF extraction
- DOCX extraction
- PPTX extraction
- Text extraction
- Image OCR
- Document chunking
- Vector search

### Integrations
- Gmail
- Google Calendar
- YouTube
- Qdrant
- WebSockets

## 📁 Project Structure

```text
StudyVerseAi/
│
├── Backend/
│   ├── server.cjs
│   ├── package.json
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── ai/
│   ├── src/
│   │   ├── ai/
│   │   ├── agents/
│   │   ├── documents/
│   │   ├── memory/
│   │   ├── observability/
│   │   ├── rag/
│   │   └── orchestrator.cjs
│   ├── tests/
│   └── smokeTest.cjs
│
├── Frontend/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── dashboard.html
│   ├── dashboard.js
│   └── dashboard.css
│
├── .gitignore
├── package-lock.json
└── README.md
```

## 🚀 Getting Started

### Requirements

- Node.js 20+
- npm
- MongoDB Atlas or local MongoDB
- At least one supported AI provider

Optional:
- LibreOffice for legacy `.ppt` extraction
- Qdrant for external vector storage
- Google OAuth credentials
- YouTube API key

### 1. Clone the Repository

```bash
git clone https://github.com/deepakpandit31/StudyVerseAi.git
cd StudyVerseAi
```

### 2. Install Backend Dependencies

```bash
cd Backend
npm install
```

### 3. Configure Environment Variables

Create `Backend/.env`:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
SESSION_SECRET=your_session_secret
PORT=5050
FRONTEND_ORIGINS=http://localhost:5050,http://127.0.0.1:5050
```

### AI Provider

At least one AI provider is required for AI features:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_gemini_model
```

Optional providers:

```env
OPENAI_API_KEY=
OPENAI_MODEL=

GROQ_API_KEY=
GROQ_MODEL=

AI_FALLBACK_PROVIDERS=gemini,openai,groq
```

### Optional Services

```env
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=smart_study_knowledge

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5050/api/google/callback

YOUTUBE_API_KEY=
```

> Never commit `.env` or real API keys to GitHub.

## ▶️ Run the Application

From `Backend`:

```bash
npm start
```

Open:

```text
http://localhost:5050
```

Do not open the frontend HTML directly using `file://`. Run the application through the backend so authentication, APIs, cookies, and WebSockets work correctly.

## 🔐 Authentication

StudyVerse AI uses JWT-based authentication.

```text
Register
   ↓
Login
   ↓
JWT Token
   ↓
Authenticated Application
```

Protected requests use:

```http
Authorization: Bearer <token>
```

Authenticated users can access AI features, documents, RAG, quizzes, flashcards, study plans, progress, todos, study rooms, and career tools.

## 🤖 AI Architecture

```text
User Request
     │
     ▼
AI Gateway
     │
     ▼
Model / Provider Selection
     │
     ├── Gemini
     ├── OpenAI
     └── Groq
     │
     ▼
AI Response
```

The shared AI layer provides common provider configuration, model routing, fallback handling, and AI services.

## 🔄 AI Fallback

```text
Request
   │
   ▼
Primary Provider
   │
   ├── Success ──────────► Response
   │
   └── Temporary Failure
              │
              ▼
        Fallback Provider
              │
              ▼
           Response
```

## 📄 RAG & Document Processing

```text
Upload Document
      │
      ▼
Extract Text
      │
      ▼
Clean & Chunk
      │
      ▼
Generate Embeddings
      │
      ▼
Vector Storage
      │
      ▼
RAG Retrieval
      │
      ▼
AI Answer
```

Documents are associated with authenticated users so one user's indexed documents are not returned to another user.

## 🔌 API Overview

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### AI

```text
POST /api/ai/chat
POST /api/ai/task
GET  /api/ai/status
POST /api/ai/test-models
```

### Documents & RAG

```text
POST /api/documents/upload
POST /api/documents/ingest
GET  /api/documents
POST /api/rag/query
```

### Learning

```text
GET      /api/dashboard
GET/PUT  /api/users/profile
GET/POST /api/quizzes
POST     /api/quiz-attempts/:quizId
GET      /api/progress
GET      /api/analytics/overview
GET/POST /api/plans
POST     /api/tutor/chat
```

### Productivity

```text
GET/POST/PATCH/DELETE /api/todos
```

### Research & Media

```text
POST /api/research
GET  /api/videos
```

### Career Tools

```text
POST /api/coding/solve
POST /api/interview/question
POST /api/interview/evaluate
POST /api/resume/review
```

### Study Rooms

```text
POST /api/rooms
WS   /ws
```

## 🧪 Testing

Run backend QA:

```bash
cd Backend
npm run qa
```

Run the smoke test after starting the server:

```bash
npm run smoke
```

Or:

```bash
TEST_URL=http://localhost:5050 npm run smoke
```

Testing covers areas including authentication, JWT protection, AI integration, provider fallback, document upload, RAG isolation, API contracts, CORS, rate limiting, OAuth behavior, and frontend structure.

## 🔒 Security

- Never commit `.env`
- Never expose API keys in frontend code
- Use strong JWT and session secrets
- Restrict production CORS origins
- Keep authentication enabled for protected APIs
- Use HTTPS in production
- Configure OAuth redirect URLs correctly
- Keep WebSocket origins restricted

The optional code execution feature is disabled by default. Do not expose arbitrary code execution publicly without proper sandboxing and container isolation.

## 🌐 Deployment

For production:

1. Deploy the backend.
2. Configure environment variables.
3. Configure MongoDB.
4. Configure your AI provider.
5. Configure CORS origins.
6. Configure Google OAuth redirect URLs if required.
7. Deploy the frontend or serve it through the backend.
8. Enable HTTPS.
9. Verify WebSocket support for Study Rooms.

Browser microphone features require HTTPS or localhost.

## 📱 Responsive Design

StudyVerse AI is designed for:
- Desktop
- Laptop
- Tablet
- Mobile

The frontend includes responsive navigation, mobile navigation, responsive dashboards, loading states, disabled states, and reduced-motion support.

## 🎓 Study Workflow

```text
Upload Notes
     │
     ▼
AI Understands Content
     │
     ├── Summary
     ├── Flashcards
     ├── Quiz
     ├── Mind Map
     └── Questions
            │
            ▼
       AI Tutor
            │
            ▼
      Track Progress
            │
            ▼
       Adaptive Plan
```

## 🧠 Learning System

The learning system combines:
- AI Tutor
- Study Packs
- Flashcards
- Quizzes
- Study Plans
- Progress tracking
- Analytics
- Adaptive learning
- Spaced repetition

## 🛣️ Future Improvements

- More AI providers
- Better multimodal learning
- Advanced personalized learning
- Improved recommendation systems
- More educational integrations
- Better offline support
- Mobile application
- Advanced analytics
- More collaboration features

## 👨‍💻 Authors

This project was developed collaboratively by:

### Aditya Kumar
Full Stack / AI Development

### Ansh Pratap
Full Stack / AI Development

### Deepak Sikhwal
Full Stack MERN / AI Development

## 🤝 Contributors

- Aditya Kumar
- Ansh Pratap
- Deepak Sikhwal

## 📄 License

This project is currently intended for educational and development purposes.

Add an appropriate open-source license before distributing the project for external use.

---

## ⭐ StudyVerse AI

**Learn smarter. Practice better. Build your future.**
