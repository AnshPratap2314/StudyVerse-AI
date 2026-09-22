const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const server = fs.readFileSync(path.join(root, "Backend", "server.cjs"), "utf8");
const frontend = fs.readFileSync(path.join(root, "Frontend", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "Frontend", "index.html"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "Frontend", "dashboard.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "Backend", "package.json"), "utf8"));

function has(text, needle) { assert.ok(text.includes(needle), `Expected source to contain: ${needle}`); }

 test("Person 1 shared AI contract is wired end-to-end", () => {
  has(server, 'app.post("/api/ai/chat"');
  has(server, 'app.post("/api/ai/task"');
  has(server, 'app.post("/api/documents/upload"');
  has(server, 'const orchestrator = new Orchestrator');
  has(server, 'global.smartStudyAI = { gateway, rag, memory, orchestrator, metrics }');
});

test("Person 2 authentication and learning routes are wired", () => {
  for (const route of [
    'app.use("/api/auth", require("./routes/auth"))',
    'app.use("/api/users", require("./routes/users"))',
    'app.use("/api/quizzes", require("./routes/quizzes"))',
    'app.use("/api/flashcards", require("./routes/flashcards"))',
    'app.use("/api/plans", require("./routes/planner"))',
    'app.use("/api/dashboard", require("./routes/dashboard"))',
    'app.use("/api/analytics", require("./routes/analytics"))',
    'app.use("/api/tutor", require("./routes/tutor"))'
  ]) has(server, route);
  has(frontend, '/api/auth/me');
  has(dashboard, '/api/dashboard');
});

test("Person 3 integration endpoints remain present", () => {
  for (const route of [
    'app.get("/api/todos"',
    'app.get("/api/google/auth"',
    'app.get("/api/gmail/messages"',
    'app.post("/api/gmail/send"',
    'app.get("/api/calendar/events"',
    'app.post("/api/research"',
    'app.get("/api/videos"',
    'app.post("/api/coding/solve"',
    'app.post("/api/interview/question"',
    'app.post("/api/interview/evaluate"',
    'app.post("/api/resume/review"',
    'app.post("/api/study-plan"',
    'app.post("/api/rooms"'
  ]) has(server, route);
  has(server, 'path: "/ws"');
});

test("Shared AI endpoints are not duplicated", () => {
  for (const pathName of ["/api/analysis", "/api/ask", "/api/ai/chat", "/api/ai/task"]) {
    const count = (server.match(new RegExp(`app\\.post\\(["']${pathName.replace(/\//g, "\\/")}["']`, "g")) || []).length;
    assert.equal(count, 1, `${pathName} should have exactly one POST route`);
  }
});

test("Health endpoint stays public while feature APIs require auth", () => {
  has(server, 'app.get("/api/health"');
  has(server, 'app.use([\n    "/api/ai"');
  has(server, 'requireLearningAuth);');
});

test("Frontend API calls attach the JWT and keep Google cookies", () => {
  has(frontend, 'headers.Authorization = `Bearer ${accessToken}`');
  has(frontend, 'credentials: "include"');
});

test("Frontend feature controls have stable IDs and handlers", () => {
  for (const id of [
    "sendBtn", "analyzeBtn", "connectGmail", "connectCalendar", "researchBtn", "createRoom", "joinRoom",
    "voiceStart", "videoBtn", "solveCode", "newQuestion", "evaluateAnswer", "logout"
  ]) has(html, `id="${id}"`);
});

test("Security/deployment controls remain present", () => {
  has(server, 'FRONTEND_ORIGINS');
  has(server, 'app.use("/api", rateLimit(120));');
  has(server, 'fileSize: 15 * 1024 * 1024');
  has(server, 'maxPayload: 64 * 1024');
  has(server, 'smart-study-sid');
  has(server, 'crypto.createHmac("sha256", SESSION_SECRET)');
  assert.equal(server.includes("x-session-id"), false);
});

test("Frontend has all requested API contracts", () => {
  for (const pathName of [
    "/api/ai/chat", "/api/ai/task", "/api/documents/upload", "/api/todos", "/api/gmail/messages",
    "/api/calendar/events", "/api/research", "/api/videos", "/api/coding/solve", "/api/interview/question",
    "/api/interview/evaluate", "/api/rooms", "/api/auth/"
  ]) has(frontend, pathName);
});

test("Project scripts remain runnable without requiring a global CLI", () => {
  assert.equal(packageJson.scripts.start, "node server.cjs");
  assert.equal(packageJson.scripts.qa, "npm run check && npm test");
  assert.match(packageJson.scripts.smoke, /node smokeTest\.cjs/);
});
