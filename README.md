::: {align="center"}
# StudyVerse AI

### Your AI-powered workspace for learning, research, and career preparation.

**Learn with context. Practice with purpose. Make progress that lasts.**

```{=html}
<p>
```
`<a href="https://study-verse-ai-eight.vercel.app">`{=html}`<strong>`{=html}Live
Application`</strong>`{=html}`</a>`{=html}  · 
`<a href="https://github.com/deepakpandit31/StudyVerseAi">`{=html}`<strong>`{=html}GitHub
Repository`</strong>`{=html}`</a>`{=html}
```{=html}
</p>
```
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-Backend-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white)
![AI](https://img.shields.io/badge/AI-Multi--Provider-6C63FF)
![RAG](https://img.shields.io/badge/RAG-Document%20Intelligence-2563EB)
:::Overview
StudyVerse AI is a full-stack AI-powered learning platform built to
bring studying, research, productivity, collaboration, and career
preparation into one connected workspace.

Instead of switching between separate tools for notes, quizzes,
research, coding help, and interview practice, students can use
StudyVerse AI to move through the learning process in one place. Its AI
capabilities support conversational tutoring, document-based question
answering, study material generation, and structured learning workflows.

The platform combines a web application, an Express.js backend, a
MongoDB data layer, real-time communication, and an AI integration layer
that can work with supported providers such as Google Gemini, OpenAI,
and Groq.
Live application: https://study-verse-ai-eight.vercel.app

What you can do with StudyVerse AI
AI Study Assistant
- Ask study-related questions through an AI chat interface.
- Switch between multiple tutor modes and learning approaches.
- Get beginner-friendly explanations and revision support.
- Use exam-focused and Socratic learning workflows.
- Continue context-aware conversations with AI memory support.
- Prepare for technical and general interviews.
Study Tools
- Generate structured Study Packs.
- Summarize notes and learning materials.
- Create flashcards and AI-generated quizzes.
- Build mind maps and personalized study plans.
- Track learning progress and review learning analytics.
- Support spaced repetition and adaptive learning workflows.
Document Intelligence
Upload learning material and use it as context for AI-assisted study.

Supported formats include:

  Category         Formats
  Documents        PDF, DOCX, DOC
Presentations    PPTX, PPT
Text and data    TXT, Markdown, CSV, JSON
Visual content   Images

The document workflow extracts text, prepares searchable chunks, and
supports retrieval-augmented generation (RAG) so responses can use
relevant information from uploaded material.
AI Research
- Get AI-assisted, structured research responses.
- Discover educational resources.
- Search for relevant videos.
- Bring research context into study workflows.
Productivity and Planning
- Organize tasks with todos and reminders.
- Use browser notifications.
- Plan study sessions and learning goals.
- Connect Gmail and Google Calendar when configured.
Collaborative Study Rooms
- Create and join study rooms.
- Communicate through real-time messaging.
- Share notes and quizzes.
- Use a room-level AI tutor.
- Communicate through WebSocket-based functionality.
Developer Tools
- Get help with programming questions.
- Generate and understand code.
- Work through coding problems.
- Use code-related RAG context.
- Use optional local code execution where enabled.
Career Preparation
- Generate interview questions.
- Evaluate interview answers.
- Review resumes.
- Practice technical interview topics.
Voice and Multimedia
- Interact through voice features.
- Use text-to-speech support.
- Discover educational videos.
- Explore AI-generated interactive lessons.
- Ask questions about image-based content.
Platform Architecture
The application is organized around a frontend, an API backend, and
supporting AI, learning, and integration services.
                         ┌─────────────────────┐
                         │        User         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Web Application   │
                         │  Login / Dashboard  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     Express API     │
                         │ Auth · REST · WS    │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │     AI Core     │    │ Learning System │    │  Integrations   │
    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
    │ Provider Gateway│    │ Dashboard       │    │ Gmail           │
    │ Model Routing   │    │ Quizzes          │    │ Google Calendar │
    │ Agent Workflows │    │ Flashcards       │    │ Research        │
    │ RAG             │    │ Study Plans      │    │ YouTube         │
    │ Memory          │    │ Analytics        │    │ Study Rooms     │
    │ Document Tools  │    │ Progress         │    │ Voice / Coding  │
    └────────┬────────┘    └─────────────────┘    │ Career Tools    │
             │                                     └─────────────────┘
             ▼
    ┌─────────────────────────────────────────────┐
    │ Gemini · OpenAI · Groq                      │
    └─────────────────────────────────────────────┘

             ┌─────────────────────────────────────┐
             │ MongoDB · Optional Qdrant           │
             └─────────────────────────────────────┘
AI request flow
User Request
     │
     ▼
AI Gateway
     │
     ▼
Provider / Model Selection
     │
     ├── Google Gemini
     ├── OpenAI
     └── Groq
     │
     ▼
AI Service / Orchestration
     │
     ▼
Response
The shared AI layer centralizes provider configuration, model selection,
fallback handling, and AI service access.
Provider fallback
When a configured provider is temporarily unavailable, the application
can attempt another configured provider according to its fallback
configuration.
Request
   │
   ▼
Primary AI Provider
   │
   ├── Success ─────────────► Return response
   │
   └── Temporary failure
              │
              ▼
        Fallback provider
              │
              ▼
         Return response
Document RAG workflow
Upload
  │
  ▼
Text Extraction
  │
  ▼
Cleaning and Chunking
  │
  ▼
Embedding Generation
  │
  ▼
Vector Storage
  │
  ▼
Relevant Context Retrieval
  │
  ▼
Context-aware AI Answer
Document records and retrieval are associated with authenticated users
to help keep one user's indexed material separate from another user's
results.
Technology Stack
  Layer                               Technologies
  Frontend                            HTML5, CSS3, JavaScript, responsive
UI

  Backend                             Node.js, Express.js

  API and communication               REST APIs, WebSockets

  Authentication                      JWT

  Database                            MongoDB

  AI providers                        Google Gemini, OpenAI, Groq

  AI architecture                     Provider gateway, model routing,
multi-agent orchestration, RAG, AI
memory

  Document processing                 PDF/DOCX/PPTX extraction, text
extraction, OCR, chunking, vector
search

  Vector database                     Qdrant (optional)

  Integrations                        Gmail, Google Calendar, YouTube
Testing                             Backend QA scripts and smoke tests
Project Structure
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
Getting Started
Prerequisites
Make sure the following are available:
- Node.js 20 or later
- npm
- MongoDB Atlas or a local MongoDB instance
- At least one supported AI provider API key
Optional services and tools
- Qdrant for external vector storage
- LibreOffice for legacy .ppt extraction
- Google OAuth credentials for Gmail and Calendar integrations
- YouTube Data API key for video discovery
1. Clone the repository
git clone https://github.com/deepakpandit31/StudyVerseAi.git
cd StudyVerseAi
2. Install backend dependencies
cd Backend
npm install
3. Configure environment variables
Create a .env file inside the Backend directory.
# Server
PORT=5050
FRONTEND_ORIGINS=http://localhost:5050,http://127.0.0.1:5050

# Database
MONGODB_URI=your_mongodb_connection_string

# Authentication and sessions
JWT_SECRET=your_long_random_secret
SESSION_SECRET=your_session_secret

# Primary AI provider
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_gemini_model
At least one supported AI provider must be configured for AI-powered
features.

Optional AI providers
OPENAI_API_KEY=
OPENAI_MODEL=

GROQ_API_KEY=
GROQ_MODEL=

AI_FALLBACK_PROVIDERS=gemini,openai,groq
Optional integrations and vector storage
# Qdrant
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=smart_study_knowledge

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5050/api/google/callback

# YouTube
YOUTUBE_API_KEY=
Use the variable names expected by the application configuration. Add
production frontend origins and OAuth callback URLs when deploying.
Security: Never commit .env files, passwords, tokens, or real
API keys to source control. Use strong, unique secrets and configure
production credentials through your hosting provider's
environment-variable settings.

4. Start the application
From the Backend directory:
npm start
Open the local application:
http://localhost:5050
Run the frontend through the backend rather than opening an HTML file
directly with file://. The application relies on backend routes,
authentication, cookies, and WebSocket communication.
Authentication
StudyVerse AI uses JWT-based authentication for protected application
features.
Register
   │
   ▼
Login
   │
   ▼
JWT issued
   │
   ▼
Authenticated requests
   │
   ▼
Protected application features
Protected API requests use the bearer-token format:
Authorization: Bearer <token>
Authenticated workflows include AI features, document tools, RAG,
quizzes, flashcards, study plans, progress tracking, todos, study rooms,
and career tools.
API Overview
The following routes represent the documented API surface.
Authentication
  Method   Endpoint
  POST     /api/auth/register
POST     /api/auth/login
GET      /api/auth/me
POST     /api/auth/logout
AI
  Method   Endpoint
  POST     /api/ai/chat
POST     /api/ai/task
GET      /api/ai/status
POST     /api/ai/test-models
Documents and RAG
  Method   Endpoint
  POST     /api/documents/upload
POST     /api/documents/ingest
GET      /api/documents
POST     /api/rag/query
Learning
  Method       Endpoint
  GET          /api/dashboard
GET / PUT    /api/users/profile
GET / POST   /api/quizzes
POST         /api/quiz-attempts/:quizId
GET          /api/progress
GET          /api/analytics/overview
GET / POST   /api/plans
POST         /api/tutor/chat
Productivity
  Method                        Endpoint
  GET / POST / PATCH / DELETE   /api/todos
Research and media
  Method   Endpoint
  POST     /api/research
GET      /api/videos
Career tools
  Method   Endpoint
  POST     /api/coding/solve
POST     /api/interview/question
POST     /api/interview/evaluate
POST     /api/resume/review
Study rooms
  Method      Endpoint
  POST        /api/rooms
WebSocket   /ws
Testing and Quality Checks
Run the backend QA suite from the Backend directory:
npm run qa
Start the application, then run the smoke test:
npm run smoke
To specify a test server URL:
TEST_URL=http://localhost:5050 npm run smoke
The documented test coverage includes:
- Authentication and JWT protection
- AI integration and provider fallback
- Document upload and RAG user isolation
- API contracts
- CORS behavior and rate limiting
- OAuth behavior
- Frontend structure
Run the checks in your local environment after making changes and before
deploying.
Security Considerations
Security-sensitive configuration should be handled carefully:
- Keep .env and all credentials out of version control.
- Never expose provider API keys in frontend code.
- Use strong, unique JWT and session secrets.
- Restrict production CORS origins to trusted domains.
- Keep protected endpoints behind authentication.
- Use HTTPS in production.
- Configure OAuth redirect URLs to match the deployed application.
- Restrict WebSocket origins.
- Apply appropriate access controls to uploaded documents and
  retrieval.
- Do not expose arbitrary code execution publicly without sandboxing
  and container isolation.
The optional code execution capability is disabled by default.
Deployment
The live application is available at:

https://study-verse-ai-eight.vercel.app

For a production deployment, configure the application components and
services required by your environment:
1. Deploy the backend to a host that supports the required Node.js
   runtime.
2. Configure the MongoDB connection string.
3. Add the required AI provider credentials.
4. Set the production frontend origin in CORS configuration.
5. Configure Google OAuth credentials and callback URLs if those
   integrations are enabled.
6. Configure optional Qdrant and YouTube credentials if used.
7. Deploy the frontend or serve it through the backend, according to
   your deployment setup.
8. Enable HTTPS.
9. Confirm that the hosting environment supports WebSocket connections
   if Study Rooms are enabled.
10. Test authentication, document upload, AI requests, and the main
    learning workflows in production.
Browser microphone features require HTTPS or localhost.
Responsive Experience
The frontend is designed to support:
- Desktop and laptop screens
- Tablets
- Mobile devices
The interface includes responsive navigation, mobile navigation,
responsive dashboards, loading and disabled states, and reduced-motion
support.
A Typical Study Workflow
Add your learning material
          │
          ▼
AI processes the content
          │
          ├── Generate a summary
          ├── Create flashcards
          ├── Build a quiz
          ├── Create a mind map
          └── Ask document-based questions
                    │
                    ▼
               Learn with AI Tutor
                    │
                    ▼
              Review your progress
                    │
                    ▼
             Refine your study plan
The goal is to connect learning activities rather than treat notes,
practice, revision, and progress as separate tasks.
Roadmap
Potential areas for continued development include:
- Additional AI provider integrations
- More capable multimodal learning workflows
- More personalized learning recommendations
- Improved recommendation and analytics systems
- Additional educational integrations
- Better offline support
- A dedicated mobile application
- Expanded collaboration features
Contributors
StudyVerse AI was developed collaboratively by:

  Contributor          Focus
  Aditya Kumar     Full Stack / AI Development
Ansh Pratap      Full Stack / AI Development
Deepak Sikhwal   Full Stack MERN / AI Development

Contributions, feedback, and suggestions are welcome.
License
This project is currently intended for educational and development
purposes. No open-source license is specified at this time. Add an
appropriate license file before distributing the project for external
use.
::: {align="center"}
### StudyVerse AI

**Learn smarter. Practice better. Build your future.**

[Open the Live Application](https://study-verse-ai-eight.vercel.app)
:::
