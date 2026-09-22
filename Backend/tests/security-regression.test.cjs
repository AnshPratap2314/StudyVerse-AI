const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.cjs"), "utf8");
const auth = fs.readFileSync(path.join(root, "controllers", "authController.js"), "utf8");
const gateway = fs.readFileSync(path.join(root, "src", "ai", "gateway.cjs"), "utf8");
const providers = fs.readFileSync(path.join(root, "src", "ai", "providers.cjs"), "utf8");
const smoke = fs.readFileSync(path.join(root, "smokeTest.cjs"), "utf8");
const app = fs.readFileSync(path.join(root, "..", "Frontend", "app.js"), "utf8");
const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");

function has(text, needle) { assert.ok(text.includes(needle), `Expected source to contain: ${needle}`); }

test("Google OAuth is bound to authenticated user identity", () => {
  has(server, 'global.smartStudyGoogleSessions = googleSessions');
  has(server, 'userId: String(req.user.id)');
  has(server, 'String(session.userId) !== String(userId)');
  has(server, 'persistGoogleIntegration');
  has(server, 'loadGoogleIntegration');
  has(auth, 'global.smartStudyGoogleSessions');
  has(auth, 'GoogleIntegration.deleteOne');
});

test("Google OAuth tokens are encrypted at rest", () => {
  has(server, 'crypto.createCipheriv("aes-256-gcm"');
  has(server, 'crypto.createDecipheriv("aes-256-gcm"');
  has(server, 'accessToken: encryptSecret(session.access_token)');
  has(server, 'refreshToken: encryptSecret(session.refresh_token)');
});

test("Password reset never exposes tokens in production and supports email delivery", () => {
  has(auth, 'process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_RESET_TOKEN === "true"');
  assert.equal(auth.includes('process.env.NODE_ENV !== "production" || process.env.EXPOSE_RESET_TOKEN'), false);
  has(auth, 'RESEND_API_KEY');
  has(auth, 'PASSWORD_RESET_FROM');
  has(env, 'ALLOW_DEV_RESET_TOKEN=false');
});

test("Password reset uses the normalized email variable for delivery", () => {
  has(auth, 'const normalizedEmail = email;');
  has(auth, 'sendPasswordResetEmail({ to: normalizedEmail, token: rawToken })');
});

test("Rate limiting does not create a new session for every anonymous request", () => {
  has(server, 'req.socket?.remoteAddress');
  has(server, 'jwt.verify(header.slice(7), process.env.JWT_SECRET)');
  assert.equal(server.includes('const key = `${req.ip || "unknown"}:${getSessionId(req, res)}`;'), false);
});

test("Code execution fails closed unless Docker sandbox or explicit local mode is configured", () => {
  has(server, 'CODE_EXECUTION_MODE || "docker"');
  has(server, 'ALLOW_UNSANDBOXED_CODE');
  has(server, '"--network", "none"');
  has(server, '"--memory"');
  has(server, '"--pids-limit"');
  has(server, '"--read-only"');
});

test("Application state uses asynchronous persistence and MongoDB when configured", () => {
  has(server, 'AppState.findOneAndUpdate');
  has(server, 'fs.promises.writeFile');
  has(server, 'stateWritePromise');
  assert.equal(server.includes('fs.writeFileSync(tempFile'), false);
});

test("Research uses the shared AI gateway", () => {
  const section = server.slice(server.indexOf('app.post("/api/research"'), server.indexOf('// ============================================================\n// EDUCATIONAL VIDEO SEARCH'));
  has(section, 'gateway.generate');
  has(section, 'googleSearch');
  assert.equal(section.includes('geminiGenerate({'), false);
});

test("Multimodal image extraction uses cost-aware provider selection", () => {
  has(gateway, 'vision: true');
  has(gateway, 'defaultVisionModel');
  has(gateway, 'AI_BUDGET_EXCEEDED');
  has(providers, 'generateImageExtraction');
  has(app, '/api/ai/chat/multimodal');
});

test("AI budget is a hard ceiling by default", () => {
  has(gateway, 'AI_HARD_BUDGET !== "false"');
  has(gateway, 'Estimated AI request cost');
  has(gateway, 'error.code = "AI_BUDGET_EXCEEDED"');
  has(env, 'AI_HARD_BUDGET=true');
});

test("Study-room WebSocket requires authenticated membership", () => {
  has(server, 'app.post("/api/rooms/:roomId/join"');
  has(server, 'Valid authentication token required.');
  has(server, 'room.allowedUsers.has(userId)');
  has(app, '/api/rooms/${encodeURIComponent(normalized)}/join');
});

test("Smoke test bootstraps a temporary backend and cleans it up", () => {
  has(smoke, 'starting a temporary smoke-test server');
  has(smoke, 'spawn(process.execPath, ["server.cjs"]');
  has(smoke, 'child.kill("SIGTERM")');
  has(env, 'CODE_EXECUTION_MODE=docker');
});

test("AI budget uses per-user/session atomic reservations instead of global spend", () => {
  has(gateway, 'this.budgets = new Map()');
  has(gateway, 'budgetKey(options)');
  has(gateway, 'reservation = this.reserveBudget(budgetKey, effectiveBudgetUsd, estimatedRequestCost)');
  has(gateway, 'settleBudget(budgetKey, reservation, cost)');
  has(gateway, 'cap - current.actualUsd - current.reservedUsd');
  assert.equal(gateway.includes('budgetUsd - this.usage.estimatedUsd'), false);
});

test("Study rooms require a private invite token for non-owners", () => {
  has(server, 'inviteTokenHash');
  has(server, 'validRoomInvite');
  has(server, 'A valid study-room invite token is required.');
  has(server, 'crypto.randomBytes(32).toString("hex")');
});

test("WebSocket authentication is sent after connection, not in the URL", () => {
  has(app, 'roomSocket.send(JSON.stringify({ type: "auth", token: token() }))');
  assert.equal(app.includes('/ws?room=${encodeURIComponent(normalized)}&name=${encodeURIComponent(name)}&token='), false);
  has(server, 'message.type !== "auth"');
  has(server, 'Authentication required.');
});

test("Global Express error handler is mounted", () => {
  has(server, 'const errorHandler = require("./middleware/errorHandler");');
  has(server, 'app.use(errorHandler);');
});

test("Password reset raw token is transported in the URL fragment", () => {
  has(auth, '/#resetToken=${encodeURIComponent(token)}');
  assert.equal(auth.includes('/?resetToken='), false);
  has(app, 'window.location.hash.replace(/^#/, "")');
});

test("Google credential encryption has a persistent production key requirement", () => {
  has(server, 'GOOGLE_TOKEN_ENCRYPTION_KEY');
  has(server, 'SESSION_SECRET is required in production');
  has(env, 'GOOGLE_TOKEN_ENCRYPTION_KEY=');
});

test("Abuse-sensitive endpoints have dedicated rate limits", () => {
  has(server, 'app.use("/api/auth/login", rateLimit(8, 60 * 1000));');
  has(server, 'app.use("/api/auth/register", rateLimit(5, 60 * 60 * 1000));');
  has(server, 'rateLimitByEmail(3, 60 * 60 * 1000)');
  has(server, 'app.post("/api/ai/test-models", rateLimit(3, 60 * 1000)');
});

test("Code sandbox drops Linux capabilities and disables privilege escalation", () => {
  has(server, '"--cap-drop", "ALL"');
  has(server, '"--security-opt", "no-new-privileges"');
  has(server, '"--user", "65532:65532"');
});

test("Document archives have entry, size and conversion time limits", () => {
  const docs = fs.readFileSync(path.join(root, "src", "documents", "document-service.cjs"), "utf8");
  has(docs, 'DOCUMENT_MAX_ARCHIVE_ENTRIES');
  has(docs, 'DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES');
  has(docs, 'DOCUMENT_ARCHIVE_TIMEOUT_MS');
  has(docs, 'DOCUMENT_CONVERSION_TIMEOUT_MS');
  has(docs, 'Document archive expands beyond the allowed size.');
});

test("Research links only allow HTTP(S) URLs", () => {
  has(app, 'function safeExternalUrl');
  has(app, '["http:", "https:"]');
  has(app, 'safeExternalUrl(source.url)');
});

test("AI metrics are account scoped and memory supports MongoDB persistence", () => {
  has(server, 'metrics.snapshot(req.user.id)');
  has(server, 'await memory.counts(req.user.id)');
  const memoryStore = fs.readFileSync(path.join(root, "src", "memory", "memory-store.cjs"), "utf8");
  has(memoryStore, 'this.model');
  has(memoryStore, 'this.dbReady');
  has(memoryStore, 'kind: "conversation"');
  has(server, 'new MemoryStore(path.join(aiDataPath, "memory-store.json"), AIMemoryModel, isDbConnected)');
});

test("Production rejects local-only persistence fallbacks", () => {
  has(server, 'MONGODB_URI is required in production');
  has(server, 'QDRANT_URL is required in production');
});

test("Smoke test no longer installs dependencies implicitly", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts.smoke, 'node smokeTest.cjs');
  assert.equal(pkg.scripts.ci, 'npm ci');
});

test("Study pack output is normalized into real flashcards and four-option quiz questions", () => {
  const { normalizeStudyPack } = require(path.join(root, "src", "agents", "study-agent.cjs"));
  const pack = normalizeStudyPack({
    summary: "A grounded summary.",
    keywords: ["Python", "Python", "RAG"],
    flashcards: Array.from({ length: 8 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` })),
    quiz: Array.from({ length: 5 }, (_, i) => ({ question: `Quiz ${i}`, options: ["A", "B", "C", "D"], answer: "b" })),
    mindmap: { mainTopic: "Python", subTopics: ["Syntax", "RAG"] }
  }, "Python");
  assert.equal(pack.flashcards.length, 8);
  assert.equal(pack.quiz.length, 5);
  assert.deepEqual(pack.keywords, ["Python", "RAG"]);
  assert.equal(pack.quiz[0].answer, "B");
});
