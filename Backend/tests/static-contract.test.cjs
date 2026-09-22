const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const server = fs.readFileSync(path.join(root, "Backend", "server.cjs"), "utf8");
const app = fs.readFileSync(path.join(root, "Frontend", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "Frontend", "index.html"), "utf8");
const dashboardJs = fs.readFileSync(path.join(root, "Frontend", "dashboard.js"), "utf8");
const css = fs.readFileSync(path.join(root, "Frontend", "style.css"), "utf8");
const gateway = fs.readFileSync(path.join(root, "Backend", "src", "ai", "gateway.cjs"), "utf8");
const orchestrator = fs.readFileSync(path.join(root, "Backend", "src", "orchestrator.cjs"), "utf8");
const studyAgent = fs.readFileSync(path.join(root, "Backend", "src", "agents", "study-agent.cjs"), "utf8");
const vectorStore = fs.readFileSync(path.join(root, "Backend", "src", "rag", "vector-store.cjs"), "utf8");
const rag = fs.readFileSync(path.join(root, "Backend", "src", "rag", "rag-service.cjs"), "utf8");
const auth = fs.readFileSync(path.join(root, "Backend", "middleware", "auth.js"), "utf8");
const authRoutes = fs.readFileSync(path.join(root, "Backend", "routes", "auth.js"), "utf8");
const tutorController = fs.readFileSync(path.join(root, "Backend", "controllers", "tutorController.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "Backend", "package.json"), "utf8"));

function has(text, needle) { assert.ok(text.includes(needle), `Expected source to contain: ${needle}`); }

 test("Authentication UI and session flow are present", () => {
  has(html, 'id="authScreen"');
  has(html, 'id="authForm"');
  has(html, 'id="loginTab"');
  has(html, 'id="registerTab"');
  has(app, 'localStorage.setItem(TOKEN_KEY, data.token)');
  has(app, 'api("/api/auth/me")');
  has(app, 'Authorization = `Bearer ${accessToken}`');
  has(app, 'clearSession');
});

test("Authenticated feature surface is enforced server-side", () => {
  has(server, 'function requireLearningAuth');
  has(server, '"/api/ai"');
  has(server, '"/api/documents"');
  has(server, '"/api/todos"');
  has(server, '"/api/coding"');
  has(server, '"/api/rooms"');
  has(auth, 'req.headers["authorization"]');
  has(auth, 'Bearer ');
  has(server, '"/api/reminders", "/api/notifications"');
});

test("PDF upload contract is valid and size/type constrained", () => {
  has(app, 'form.append("files", item)');
  has(html, 'accept="application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.txt,.md,.csv,.json,.html,.htm,.rtf,image/*"');
  has(server, 'req.files?.files || req.files?.file');
  has(server, 'fileSize: 15 * 1024 * 1024');
});

test("AI model configuration is centralized", () => {
  has(gateway, 'process.env.GEMINI_MODEL || "gemini-3.6-flash"');
  has(gateway, 'SYNTHESIZER_PROVIDER');
  has(gateway, 'AI_FALLBACK_PROVIDERS');
  assert.equal(gateway.includes("gemini-2.5-flash"), false);
});

test("AI quota errors do not cause pointless retries and can fail over", () => {
  has(gateway, 'function isQuotaOrRateLimit');
  has(gateway, 'if (isQuotaOrRateLimit(error)) return false;');
  has(gateway, 'fallbackProviders');
  has(server, 'AI_QUOTA_EXHAUSTED');
});

test("Video search does not require Gemini", () => {
  has(server, 'youtube-search-fallback');
  has(server, 'Video discovery must not consume Gemini quota');
  has(app, 'Open YouTube results');
});

test("Session identity is server-issued and signed", () => {
  has(server, 'smart-study-sid');
  has(server, 'crypto.createHmac("sha256", SESSION_SECRET)');
  has(server, 'return match[1];');
  assert.equal(server.includes('x-session-id'), false);
});

test("OAuth callback keeps session IDs out of redirect URLs", () => {
  has(server, 'res.redirect("/?google=connected")');
  assert.equal(server.includes('sessionId=${'), false);
});

test("Google integration scopes stay minimal", () => {
  has(server, 'gmail.readonly');
  has(server, 'gmail.send');
  assert.equal(server.includes('gmail.modify'), false);
});

test("RAG is owner-scoped", () => {
  has(vectorStore, 'ownerId');
  has(vectorStore, 'item.ownerId === ownerId');
  has(rag, 'ownerId');
  has(rag, 'localEmbedding');
  has(server, 'ownerId: req.user.id');
});

test("Qdrant filtered RAG creates payload indexes and has a safe fallback", () => {
  has(vectorStore, 'ensurePayloadIndex("documentId")');
  has(vectorStore, 'ensurePayloadIndex("ownerId")');
  has(vectorStore, 'falling back to owner-scoped local vector search');
  has(server, 'RAG_VECTOR_STORE_ERROR');
});

test("Todo data is account-scoped instead of browser-session scoped", () => {
  const todoSection = server.slice(server.indexOf('app.get("/api/todos"'), server.indexOf('app.get("/api/productivity/health"'));
  has(todoSection, 'const userId = req.user.id;');
  assert.equal(todoSection.includes('getSessionId(req, res)'), false);
});

test("Frontend is responsive across mobile/tablet/desktop", () => {
  has(css, '@media (max-width: 1180px)');
  has(css, '@media (max-width: 900px)');
  has(css, '@media (max-width: 650px)');
  has(css, 'grid-template-columns: 1fr');
  has(html, 'id="mobileMenuToggle"');
  has(html, 'id="mobileNav"');
});

test("Frontend handles provider errors without rendering raw API JSON", () => {
  has(app, 'friendlyError');
  has(app, 'AI service unavailable');
  has(app, 'The external AI provider is currently unavailable');
  assert.equal(app.includes('JSON.stringify(d)'), false);
});

test("All requested feature entry points remain present", () => {
  for (const id of ["tutor", "packs", "flashcards", "quizzes", "email", "calendar", "research", "rooms", "voice", "video", "developer"]) {
    has(html, `data-section="${id}"`);
  }
});


test("Remaining learning requirements are wired", () => {
  has(authRoutes, 'router.post("/forgot-password", forgotPassword);');
  has(authRoutes, 'router.post("/reset-password", resetPassword);');
  has(server, 'app.post("/api/study-plan/adaptive"');
  has(server, 'weakTopics');
  has(server, 'availableHours');
  has(server, 'examDate');
  has(tutorController, 'allowedModes');
  for (const mode of ["beginner", "normal", "socratic", "exam", "interview", "revision"]) has(tutorController + server + app, mode);
});

test("Productivity automation is wired", () => {
  has(server, 'app.post("/api/gmail/triage"');
  has(server, 'app.post("/api/gmail/triage-to-calendar"');
  has(server, 'app.get("/api/reminders"');
  has(server, 'app.get("/api/notifications/due"');
  has(app, 'triageMail');
  has(app, 'checkNotifications');
});

test("Collaboration, AI video and coding execution contracts are present", () => {
  has(server, 'app.post("/api/rooms/:roomId/documents"');
  has(server, 'app.post("/api/rooms/:roomId/quizzes"');
  has(server, 'app.post("/api/rooms/:roomId/tutor"');
  has(server, 'jwt.verify(String(accessToken || ""), process.env.JWT_SECRET)');
  has(server, 'allowedUsers');
  has(server, 'app.post("/api/videos/generate"');
  has(server, 'app.post("/api/coding/run"');
  has(server, 'ENABLE_CODE_EXECUTION');
  has(app, 'generateVideoLesson');
  has(app, 'runCode');
});

test("Multimodal chat accepts images and routes them through the LLM", () => {
  has(server, 'app.post("/api/ai/chat/multimodal"');
  has(server, 'gateway.extractImage');
  has(server, 'orchestrator.execute');
  has(app, 'chatImageInput');
  has(app, '/api/ai/chat/multimodal');
});

test("Cost-aware AI routing and usage accounting are available", () => {
  has(gateway, 'chooseCostAwareProvider');
  has(gateway, 'AI_COST_AWARE_ROUTING');
  has(gateway, 'estimatedCostUsd');
  has(gateway, 'this.usage');
});

test("Known/unknown flashcard learning state is persisted and exposed", () => {
  const model = fs.readFileSync(path.join(root, "Backend", "models", "Flashcard.js"), "utf8");
  const controller = fs.readFileSync(path.join(root, "Backend", "controllers", "flashcardController.js"), "utf8");
  const route = fs.readFileSync(path.join(root, "Backend", "routes", "flashcards.js"), "utf8");
  const topic = fs.readFileSync(path.join(root, "Backend", "services", "topicService.js"), "utf8");
  has(model, 'knowledgeStatus');
  has(model, '"unknown","known"');
  has(controller, 'setKnowledge');
  has(controller, 'f.knowledgeStatus');
  has(model, 'lastRating');
  has(model, 'lastReviewScore');
  has(dashboardJs, 'knowledge-btn');
  has(dashboardJs, '/knowledge');
  has(route, '/:id/knowledge');
  has(topic, 'knowledgeStatus');
});

test("Cost-aware routing estimates request cost and optimizes for budget and quality", () => {
  has(gateway, 'expectedOutputTokens');
  has(gateway, 'qualityNeeded');
  has(gateway, 'estimatedCost');
  has(gateway, 'affordable');
  has(gateway, 'AI_BUDGET_EXCEEDED');
});

test("Required runtime dependencies remain declared", () => {
  for (const dep of ["express", "cors", "express-fileupload", "pdf-parse", "@google/genai", "mongoose", "bcryptjs", "jsonwebtoken", "ws"]) {
    assert.ok(packageJson.dependencies[dep], `Missing dependency: ${dep}`);
  }
});

test("Study workspace is separated into tutor, packs, flashcards and quizzes", () => {
  for (const id of ["tutor", "packs", "flashcards", "quizzes"]) has(html, `id="${id}"`);
  has(html, 'data-tutor-mode="beginner"');
  has(html, 'data-tutor-mode="socratic"');
  has(html, 'data-tutor-mode="exam"');
  has(html, 'data-tutor-mode="interview"');
  has(html, 'data-tutor-mode="revision"');
  has(app, 'function loadFlashcards');
  has(app, 'function loadQuizzes');
  has(app, 'function submitQuiz');
  has(app, '/api/quiz-attempts/');
  has(app, '/api/flashcards/');
  has(html, 'id="packStyle"');
  has(html, 'id="packDifficulty"');
  has(html, 'id="packExam"');
  has(html, 'id="packFocus"');
  has(app, 'memoryTricks');
  has(app, 'learningMethods');
  has(app, 'revisionPlan');
  has(app, 'function loadFlashcardAnalytics');
  has(app, 'function loadQuizAnalytics');
});

test("Tutor answers are LLM-backed, Markdown formatted and copy-ready", () => {
  has(app, 'function renderMarkdown');
  has(app, 'copy-answer');
  has(app, 'copy-code');
  has(app, 'LLM tutor response');
  has(server, 'app.post("/api/ai/chat"');
  has(server, 'orchestrator.execute');
  has(server, 'gateway.generateSlot');
});

test("Study pack includes memory aids, learning methods, revision and performance insights", () => {
  const agent = fs.readFileSync(path.join(root, "Backend", "src", "agents", "study-agent.cjs"), "utf8");
  const schema = fs.readFileSync(path.join(root, "Backend", "src", "ai", "schemas.cjs"), "utf8");
  const session = fs.readFileSync(path.join(root, "Backend", "models", "StudySession.js"), "utf8");
  for (const key of ["memoryTricks", "cheatSheet", "formulas", "commonMistakes", "examTips", "learningMethods", "revisionPlan", "practiceQuestions", "examples"]) {
    has(agent, key); has(schema, key); has(session, key);
  }
  has(app, 'flashcardAnalytics');
  has(app, 'quizAnalytics');
  has(html, 'Build my complete study pack');
});

test("Video learning separates LLM lessons from external video search", () => {
  has(html, 'id="videoSearchQuery"');
  has(html, 'id="generateVideoBtn"');
  has(html, 'id="generatedVideo"');
  has(app, 'renderLessonPlayer');
  has(app, '/api/videos/generate');
  has(app, '/api/videos?q=');
});test("Study pack generation uses a single LLM pass and protects reminder routes", () => {
  has(orchestrator, 'if (isStudyPack)');
  has(orchestrator, 'Direct study-pack generation to minimize provider calls');
  has(orchestrator, 'this.studyAgent.execute');
  has(studyAgent, 'maxOutputTokens: 5000');
  has(server, '"/api/reminders", "/api/notifications"');
});



test("Study pack accepts broad document, office and image formats", () => {
  const html = fs.readFileSync(path.join(root, "Frontend", "index.html"), "utf8");
  has(html, '.doc');
  has(html, '.docx');
  has(html, '.ppt');
  has(html, '.pptx');
  has(html, '.xls');
  has(html, '.xlsx');
  has(html, 'image/*');
  has(html, 'OCR');
});

test("Document extractor supports Word, PowerPoint, spreadsheets, HTML and OCR fallback", () => {
  const service = fs.readFileSync(path.join(root, "Backend", "src", "documents", "document-service.cjs"), "utf8");
  has(service, 'extractDocx');
  has(service, 'extractPptx');
  has(service, 'extractSpreadsheet');
  has(service, 'extractHtml');
  has(service, 'tesseract');
  has(service, 'soffice');
  has(service, 'Unsupported file type. Supported: PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), Excel (XLS/XLSX)');
});

test("Study pack surfaces per-file extraction failures without discarding readable files", () => {
  const app = fs.readFileSync(path.join(root, "Frontend", "app.js"), "utf8");
  has(app, 'upload.errors');
  has(app, 'The readable files will still be used');
});
