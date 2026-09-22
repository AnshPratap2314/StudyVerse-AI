const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");

// pdf-parse v2 can require browser canvas globals during module loading.
// Provide lightweight fallbacks so the backend can start in Node environments
// where the optional native canvas binding is unavailable. Text extraction does
// not require a real browser canvas.
if (typeof global.DOMMatrix === "undefined") {
    global.DOMMatrix = class DOMMatrix {
        constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
    };
}
if (typeof global.ImageData === "undefined") global.ImageData = class ImageData {};
if (typeof global.Path2D === "undefined") global.Path2D = class Path2D {};

const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const http = require("http");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const os = require("os");


// ============================================================
// GEMINI
// ============================================================

const aiModule = require("@google/genai");

const GoogleGenAI =
    aiModule.GoogleGenAI ||
    aiModule.default?.GoogleGenAI ||
    aiModule.default;

const Type =
    aiModule.Type ||
    aiModule.default?.Type;

// Person 1: shared AI core
const { AIGateway } = require("./src/ai/gateway.cjs");
const { createAnalysisSchema } = require("./src/ai/schemas.cjs");
const { VectorStore, QdrantVectorStore } = require("./src/rag/vector-store.cjs");
const { RAGService } = require("./src/rag/rag-service.cjs");
const { extractUploadedFile, createDocumentId } = require("./src/documents/document-service.cjs");
const { StudyAgent } = require("./src/agents/study-agent.cjs");
const { ReviewerAgent } = require("./src/agents/reviewer-agent.cjs");
const { RAGAgent } = require("./src/agents/rag-agent.cjs");
const { DocumentAgent } = require("./src/agents/document-agent.cjs");
const { ResearchAgent } = require("./src/agents/research-agent.cjs");
const { MemoryAgent } = require("./src/agents/memory-agent.cjs");
const { MemoryStore } = require("./src/memory/memory-store.cjs");
const { Orchestrator } = require("./src/orchestrator.cjs");
const { Metrics } = require("./src/observability/metrics.cjs");
const { interviewQuestions: localInterviewQuestions, evaluateInterview: localEvaluateInterview, imageExplanation: localImageExplanation, chatFallback: localChatFallback, localAiJson, studyPack: localStudyPack } = require("./src/local-fallback.cjs");
const StudyPlan = require("./models/StudyPlan");
let GoogleIntegration = null;
try { GoogleIntegration = require("./models/GoogleIntegration"); } catch {}
let AppState = null;
try { AppState = require("./models/AppState"); } catch {}
let StudyRoomModel = null;
let AIMemoryModel = null;
try { StudyRoomModel = require("./models/StudyRoom"); } catch {}
try { AIMemoryModel = require("./models/AIMemory"); } catch {}

// Person 2: learning/auth
let connectDB = async () => false;
let isDbConnected = () => false;
let authenticateToken = (req, res, next) => res.status(503).json({ success: false, error: "Learning database dependencies are not installed." });
let learningRoutesAvailable = false;
try {
    ({ connectDB, isDbConnected } = require("./config/db"));
    authenticateToken = require("./middleware/auth");
    learningRoutesAvailable = Boolean(process.env.MONGODB_URI);
} catch (error) {
    console.warn("⚠️ Learning-system dependencies are unavailable; AI core remains available. Install MongoDB dependencies to enable Person 2 routes.");
}



function requireLearningAuth(req, res, next) {
    if (!learningRoutesAvailable) {
        return res.status(503).json({ success: false, error: "Authentication requires a configured MongoDB connection." });
    }
    return authenticateToken(req, res, next);
}

if (!GoogleGenAI || !Type) {
    console.warn("⚠️ Google GenAI SDK is unavailable; AI endpoints will return configuration errors.");
}


// ============================================================
// ENVIRONMENT
// ============================================================

const PORT = Number(process.env.PORT || 5050);
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : crypto.randomBytes(32).toString("hex"));
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.error("❌ SESSION_SECRET is required in production because it protects persisted Google credentials and signed browser sessions.");
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
        console.error("❌ JWT_SECRET is required in production so authentication survives restarts.");
        process.exit(1);
    }
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    console.warn("⚠️ JWT_SECRET is not configured; a temporary secret was generated for this development process.");
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_TOKEN_ENCRYPTION_KEY = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !process.env.GOOGLE_TOKEN_ENCRYPTION_KEY && !process.env.SESSION_SECRET) {
    console.error("❌ GOOGLE_TOKEN_ENCRYPTION_KEY or SESSION_SECRET is required in production for encrypted Google credentials.");
    process.exit(1);
}


if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is missing; AI features will be unavailable until configured.");
}
if (process.env.NODE_ENV === "production" && !process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is required in production for shared persistent user data and AI memory.");
    process.exit(1);
}
if (process.env.NODE_ENV === "production" && !process.env.QDRANT_URL) {
    console.error("❌ QDRANT_URL is required in production for shared vector storage; local JSON vector fallback is development-only.");
    process.exit(1);
}


// ============================================================
// EXPRESS APP
// ============================================================

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
    next();
});

const frontendPath = path.join(
    __dirname,
    "..",
    "Frontend"
);


// ============================================================
// MIDDLEWARE
// ============================================================

const allowedOrigins = new Set(
    (process.env.FRONTEND_ORIGINS || `http://localhost:${PORT},http://127.0.0.1:${PORT}`)
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin) || (origin === "null" && process.env.ALLOW_FILE_ORIGIN === "true")) {
                return callback(null, true);
            }
            return callback(new Error("CORS origin not allowed."));
        },
        credentials: true
    })
);


app.use(
    express.json({
        limit: "15mb"
    })
);


// Lightweight per-session rate limiting for the demo deployment.
const rateBuckets = new Map();
function rateLimit(limit = 120, windowMs = 60_000) {
    return (req, res, next) => {
        const ip = String(req.ip || req.socket?.remoteAddress || "unknown");
        let identity = "anonymous";
        const header = String(req.headers.authorization || "");
        if (header.startsWith("Bearer ") && process.env.JWT_SECRET) {
            try { identity = String(jwt.verify(header.slice(7), process.env.JWT_SECRET).id || "anonymous"); } catch {}
        }
        const key = `${ip}:${identity}`;
        const now = Date.now();
        const bucket = rateBuckets.get(key);
        if (!bucket || now - bucket.startedAt >= windowMs) {
            rateBuckets.set(key, { startedAt: now, count: 1 });
            return next();
        }
        bucket.count += 1;
        if (bucket.count > limit) {
            res.setHeader("Retry-After", String(Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)));
            return res.status(429).json({ success: false, error: "Too many requests. Please wait a moment and try again." });
        }
        next();
    };
}

function rateLimitByEmail(limit = 3, windowMs = 60 * 60 * 1000) {
    return (req, res, next) => {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!email) return next();
        const ip = String(req.ip || req.socket?.remoteAddress || "unknown");
        const key = `email:${email}`;
        const now = Date.now();
        const bucket = rateBuckets.get(key);
        if (!bucket || now - bucket.startedAt >= windowMs) { rateBuckets.set(key, { startedAt: now, count: 1 }); return next(); }
        bucket.count += 1;
        if (bucket.count > limit) {
            res.setHeader("Retry-After", String(Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)));
            return res.status(429).json({ success: false, error: "Too many password-reset requests. Please wait before trying again." });
        }
        next();
    };
}

app.use("/api", rateLimit(120));

const uploadTempDir = path.join(os.tmpdir(), "smart-study-ai-uploads");
fs.mkdirSync(uploadTempDir, { recursive: true });
app.use(
    fileUpload({
        limits: {
            fileSize: 15 * 1024 * 1024,
            files: 20,
            fields: 50,
            fieldSize: 256 * 1024
        },
        abortOnLimit: true,
        useTempFiles: true,
        tempFileDir: uploadTempDir,
        createParentPath: true,
        safeFileNames: false,
        preserveExtension: true
    })
);

// Person 2: authentication + learning system routes
if (learningRoutesAvailable) {
    app.use("/api/auth/login", rateLimit(8, 60 * 1000));
    app.use("/api/auth/register", rateLimit(5, 60 * 60 * 1000));
    app.use("/api/auth/reset-password", rateLimit(5, 60 * 60 * 1000));
    app.use("/api/auth/forgot-password", rateLimit(5, 60 * 60 * 1000), rateLimitByEmail(3, 60 * 60 * 1000));
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/users", require("./routes/users"));
    app.use("/api/sessions", require("./routes/sessions"));
    app.use("/api/learning-documents", require("./routes/documents"));
    app.use("/api/quizzes", require("./routes/quizzes"));
    app.use("/api/quiz-attempts", require("./routes/quizAttempts"));
    app.use("/api/flashcards", require("./routes/flashcards"));
    app.use("/api/topics", require("./routes/topics"));
    app.use("/api/progress", require("./routes/progress"));
    app.use("/api/plans", require("./routes/planner"));
    app.use("/api/chats", require("./routes/chats"));
    app.use("/api/dashboard", require("./routes/dashboard"));
    app.use("/api/analytics", require("./routes/analytics"));
    app.use("/api/tutor", require("./routes/tutor"));
    app.use("/api/adaptive", require("./routes/adaptive"));
} else {
    app.use("/api/auth", (req, res) => res.status(503).json({ success: false, error: "Learning system requires MONGODB_URI and Person 2 dependencies." }));
    app.use("/api/dashboard", (req, res) => res.status(503).json({ success: false, error: "Learning system requires MONGODB_URI and Person 2 dependencies." }));
}



// Authenticated application surface. The public surface is limited to health/auth entry points
// and the OAuth callback, while user data and AI/productivity operations require a JWT.
app.use([
    "/api/ai", "/api/documents", "/api/rag", "/api/memory", "/api/conversations",
    "/api/analysis", "/api/ask", "/api/upload", "/api/todos", "/api/reminders", "/api/notifications", "/api/productivity",
    "/api/integrations", "/api/google/auth", "/api/gmail", "/api/calendar", "/api/research",
    "/api/videos", "/api/coding", "/api/interview", "/api/resume", "/api/study-plan", "/api/rooms"
], requireLearningAuth);

// ============================================================
// GEMINI INITIALIZATION
// ============================================================

const ai = GoogleGenAI && GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    : null;

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Person 1 AI core
const aiDataPath = path.join(__dirname, "data");
fs.mkdirSync(aiDataPath, { recursive: true });
const localVectorStore = new VectorStore(path.join(aiDataPath, "knowledge-store.json"));
const vectorStore = process.env.USE_QDRANT === "true" && process.env.QDRANT_URL
    ? new QdrantVectorStore(localVectorStore, {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collection: process.env.QDRANT_COLLECTION || "smart_study_knowledge"
    })
    : localVectorStore;
const gateway = new AIGateway();
const rag = new RAGService({ gateway, vectorStore });
const memory = new MemoryStore(path.join(aiDataPath, "memory-store.json"), AIMemoryModel, isDbConnected);
const analysisSchema = Type ? createAnalysisSchema(Type) : null;
const studyAgent = analysisSchema ? new StudyAgent({ gateway, rag, schema: analysisSchema }) : null;
const reviewerAgent = new ReviewerAgent({ gateway, rag });
const ragAgent = new RAGAgent({ gateway, rag });
const documentAgent = new DocumentAgent({ gateway, rag });
const researchAgent = new ResearchAgent({ gateway, rag });
const memoryAgent = new MemoryAgent({ gateway, rag, memory });
const orchestrator = new Orchestrator({
    gateway, rag, studyAgent, reviewerAgent, memoryAgent, ragAgent, documentAgent, researchAgent, memory
});
const metrics = new Metrics();
global.smartStudyAI = { gateway, rag, memory, orchestrator, metrics };

if (learningRoutesAvailable) connectDB().then(() => hydratePersistentStateFromMongo()).catch(() => {});


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Smart Study AI backend is working",
        architecture: "Person 1 AI core + Person 2 learning system + Person 3 integrations",
        aiCore: {
            providers: gateway.status().providers,
            vectorStore: vectorStore.stats().backend
        },
        database: isDbConnected() ? "connected" : (learningRoutesAvailable ? "connecting/unavailable" : "not configured"),
        pdfParser: "pdf-parse",
        websocket: true,
        port: PORT
    });
});

// ============================================================
// PERSON 1 SHARED AI CONTRACT
// ============================================================

function aiError(res, error, fallback = "AI request failed.") {
    let status = Number(error?.statusCode || error?.status) || 500;
    let message = error?.message || fallback;
    let code = error?.code || null;
    if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message)) {
        status = 429;
        code = code || "AI_QUOTA_EXHAUSTED";
        message = "The configured AI provider is temporarily out of quota or rate-limited. If another provider is configured, Smart Study AI will use it automatically; otherwise wait for the quota to reset or add another provider key in Backend/.env.";
    } else if (code === "AI_BUDGET_EXCEEDED" || status === 402) {
        status = 402;
        code = code || "AI_BUDGET_EXCEEDED";
        message = "This study request would exceed the AI budget for your current session. Start a new study session or increase AI_BUDGET_USD_PER_SESSION in Backend/.env.";
    } else if (/index required|payload index|qdrant/i.test(message)) {
        code = code || "RAG_VECTOR_STORE_ERROR";
        message = "The study knowledge index is temporarily unavailable. Your document is still protected to your account; retry the study pack in a moment.";
    }
    return res.status(status).json({ success: false, error: message, code, provider: error?.provider || null });
}

async function materializeUpload(file) {
    if (file?.data && Buffer.isBuffer(file.data) && file.data.length) return file;
    if (file?.tempFilePath) {
        const data = await fs.promises.readFile(file.tempFilePath);
        return { ...file, data };
    }
    throw new Error("Uploaded file data is unavailable.");
}

async function ingestCoreDocument(file, ownerId) {
    const documentId = createDocumentId();
    const hydratedFile = await materializeUpload(file);
    const extracted = await extractUploadedFile(hydratedFile, { pdfParser: PDFParse, gateway });
    if (extracted.text.length < 40) throw new Error(`${file.name}: not enough readable text.`);
    const indexed = await documentAgent.execute({
        file: hydratedFile, documentId, documentName: file.name, documentType: extracted.type,
        text: extracted.text, segments: extracted.segments, metadata: { pages: extracted.pages || null, ownerId }, ownerId
    });
    return {
        documentId, title: file.name, type: extracted.type,
        pages: extracted.pages || null, characters: extracted.text.length,
        chunks: indexed.chunks, text: extracted.text
    };
}

app.get("/api/ai/status", (req, res) => {
    res.json({
        success: true,
        gateway: gateway.status(),
        vectorStore: vectorStore.stats(),
        agents: ["orchestrator", "memory", "document", "rag", "research", "study", "reviewer"]
    });
});

app.post("/api/ai/test-models", rateLimit(3, 60 * 1000), async (req, res) => {
    try {
        const prompt = typeof req.body?.prompt === "string" && req.body.prompt.trim()
            ? req.body.prompt.trim().slice(0, 2000)
            : "Reply with exactly MODEL_TEST_OK";
        const slots = Object.keys(gateway.modelSlots);
        const results = await gateway.generateMany(slots, { prompt, json: false, maxRetries: 1, userId: req.user.id, sessionId: "model-test", budgetKey: `${req.user.id}:model-test` });
        const passed = results.filter(x => x.ok).length;
        metrics.request(passed === results.length, req.user?.id);
        res.json({
            success: passed > 0,
            allPassed: passed === results.length,
            tested: results.length,
            passed,
            failed: results.length - passed,
            results: results.map(x => ({
                slot: x.slot, ok: x.ok, provider: x.provider || gateway.modelSlots[x.slot]?.provider,
                model: x.model || gateway.modelSlots[x.slot]?.model,
                latencyMs: x.latencyMs || null, attempts: x.attempts || null,
                responsePreview: x.ok ? String(x.text || "").slice(0, 240) : null,
                error: x.ok ? null : x.error
            }))
        });
    } catch (error) {
        aiError(res, error, "Model test failed.");
    }
});

app.post("/api/documents/upload", async (req, res) => {
    try {
        const raw = req.files?.files || req.files?.file;
        const files = !raw ? [] : Array.isArray(raw) ? raw : [raw];
        if (!files.length) return res.status(400).json({ success: false, error: "No files uploaded. Use field 'files' or 'file'." });
        if (files.length > 20) return res.status(400).json({ success: false, error: "Maximum 20 files per request." });
        const documents = [], errors = [];
        for (const file of files) {
            try { documents.push(await ingestCoreDocument(file, req.user.id)); }
            catch (error) { errors.push({ file: file.name, error: error.message }); }
        }
        metrics.request(errors.length === 0, req.user?.id);
        return res.status(documents.length ? 200 : 400).json({
            success: documents.length > 0, uploaded: documents.length, failed: errors.length, documents, errors
        });
    } catch (error) { return aiError(res, error, "Document upload failed."); }
});

app.post("/api/documents/ingest", async (req, res) => {
    try {
        const raw = req.files?.files || req.files?.file;
        const files = !raw ? [] : Array.isArray(raw) ? raw : [raw];
        if (!files.length) return res.status(400).json({ success: false, error: "No file uploaded." });
        const results = [];
        for (const file of files) {
            try { results.push(await ingestCoreDocument(file, req.user.id)); }
            catch (error) { results.push({ title: file.name, error: error.message }); }
        }
        const ok = results.filter(x => !x.error);
        metrics.request(ok.length === results.length, req.user?.id);
        return res.status(ok.length ? 200 : 400).json(
            ok.length === 1
                ? { success: true, ...ok[0] }
                : { success: ok.length > 0, uploaded: ok.length, failed: results.length - ok.length, documents: ok, errors: results.filter(x => x.error) }
        );
    } catch (error) { return aiError(res, error, "Document ingestion failed."); }
});

app.get("/api/documents", (req, res) => {
    res.json({ success: true, documents: vectorStore.listDocuments(req.user.id) });
});

app.post("/api/ai/task", async (req, res) => {
    const { goal, text, title, documentId, documentIds = [], sessionId = "default", contextMode = "auto", studyPreferences = {} } = req.body || {};
    const userId = req.user.id;
    if (!goal || !String(goal).trim()) return res.status(400).json({ success: false, error: "Goal is required." });

    try {
        const result = await orchestrator.planAndExecute({
            goal: String(goal).trim(),
            text: String(text || ""),
            title,
            documentId,
            documentIds: Array.isArray(documentIds) ? documentIds.slice(0, 20) : [],
            userId,
            sessionId,
            contextMode,
            studyPreferences
        });
        metrics.request(true, req.user?.id);
        return res.json(result);
    } catch (error) {
        metrics.request(false, req.user?.id);

        // A study pack must never collapse just because an external provider,
        // vector index, model version, or network request failed. The source
        // text is already in this request, so generate a deterministic local
        // pack from that material and return HTTP 200.
        if (String(contextMode || "").toLowerCase() === "study") {
            try {
                const fallback = localStudyPack({
                    text: String(text || ""),
                    title: title || "Study Notes",
                    studyPreferences
                });
                return res.status(200).json({
                    success: true,
                    type: "study_pack",
                    ...fallback,
                    sourceText: String(text || ""),
                    provider: "local-fallback",
                    fallback: true,
                    fallbackReason: error?.message || "External study service unavailable."
                });
            } catch (fallbackError) {
                console.error("[StudyTask] Local fallback failed:", fallbackError);
            }
        }

        return aiError(res, error, "AI task failed.");
    }
});

app.post("/api/ai/chat", async (req, res) => {
    try {
        const { question, documentId, sessionId = "default", contextMode = "auto", topK = 6, tutorMode = "normal" } = req.body || {};
        const userId = req.user.id;
        if (!question || !String(question).trim()) return res.status(400).json({ success: false, error: "Question is required." });
        if (String(question).length > 12000) return res.status(400).json({ success: false, error: "Question is too long." });
        const plan = await orchestrator.plan({ goal: String(question).trim(), hasDocument: Boolean(documentId), contextMode, userId, sessionId });
        const result = await orchestrator.execute({
            type: documentId && contextMode !== "general" ? "document_chat" : "chat",
            question: String(question).trim(), documentId, userId, sessionId, topK, plan, contextMode, tutorMode
        });
        metrics.request(true, req.user?.id);
        res.json({ ...result, contextMode, plan });
    } catch (error) {
        metrics.request(false, req.user?.id);
        console.warn("[Chat] External AI unavailable; using local fallback:", error?.message || error);
        try {
            let sourceText = "";
            if (documentId) {
                const localResults = await rag.retrieve(String(question).trim(), { topK: 4, documentId, ownerId: req.user.id });
                sourceText = localResults.map(x => x.text).join(" ");
            }
            return res.json({ success: true, type: "chat", reply: localChatFallback({ question, sourceText }), provider: "local-fallback", fallback: true, contextMode });
        } catch (fallbackError) {
            return aiError(res, error, "Chat failed.");
        }
    }
});



app.post("/api/ai/chat/multimodal", async (req, res) => {
    try {
        const question = String(req.body?.question || "Explain this image for my studies.").trim();
        const tutorMode = String(req.body?.tutorMode || "normal");
        const budgetUsd = Number.isFinite(Number(req.body?.budgetUsd)) ? Number(req.body.budgetUsd) : undefined;

        if (!question) return res.status(400).json({ success: false, error: "Question is required." });

        const raw = req.files?.image || req.files?.file;
        if (!raw) return res.status(400).json({ success: false, error: "Upload an image first." });

        const file = Array.isArray(raw) ? raw[0] : raw;
        if (!String(file.mimetype || "").startsWith("image/")) {
            return res.status(400).json({ success: false, error: "Only image files are supported." });
        }
        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: "Image must be smaller than 10 MB." });
        }

        const hydratedFile = await materializeUpload(file);

        // One vision request is enough: the vision prompt explicitly asks for the
        // educational explanation. This avoids a second generation call failing
        // after successful image analysis.
        let result;
        try {
            result = await gateway.extractImage({
                data: hydratedFile.data.toString("base64"),
                mimeType: hydratedFile.mimetype,
                prompt: `${question}

You are the image-based study tutor. Analyze the uploaded image carefully and answer the student's question directly.
- Explain the visible content clearly.
- If the image contains a problem, solve it step by step.
- If it contains notes, explain and summarize them.
- If it contains a diagram, explain its components and relationships.
- If text is visible, use that text as evidence.
- If something is unreadable or ambiguous, explicitly say so.
- Never invent facts that are not visible.`,
                tutorMode, budgetUsd, userId: req.user.id, sessionId: String(req.body?.sessionId || "default")
            });
        } catch (visionError) {
            const extracted = await extractUploadedFile(hydratedFile, { pdfParser: PDFParse, gateway: null });
            result = localImageExplanation({ ocrText: extracted.text, prompt: question });
            result.fallbackReason = visionError?.message || "External vision provider unavailable.";
        }

        const reply = String(result?.text || "").trim();
        if (!reply) throw new Error("The vision model returned an empty explanation.");

        metrics.request(true, req.user?.id);
        return res.json({
            success: true,
            reply,
            provider: result.provider || null,
            model: result.model || null,
            image: {
                name: file.name,
                mimeType: file.mimetype
            }
        });
    } catch (error) {
        metrics.request(false, req.user?.id);
        return aiError(res, error, "Image explanation failed.");
    }
});

app.post("/api/rag/query", async (req, res) => {
    try {
        const { query, documentId, topK = 6 } = req.body || {};
        if (!query || !String(query).trim()) return res.status(400).json({ success: false, error: "Query is required." });
        const results = await rag.retrieve(String(query).trim(), {
            topK: Math.min(Number(topK) || 6, 12), documentId, ownerId: req.user.id
        });
        metrics.request(true, req.user?.id);
        res.json({ success: true, query, results: rag.formatSources(results).map((x, i) => ({ ...x, text: results[i].text })) });
    } catch (error) { metrics.request(false, req.user?.id); aiError(res, error); }
});

app.get("/api/memory", async (req, res) => {
    const userId = req.user.id;
    const sessionId = String(req.query.sessionId || "default");
    res.json({ success: true, userId, sessionId, ...(await memory.context(userId, sessionId, 50)) });
});

app.post("/api/memory", async (req, res) => {
    const { type = "preference", key, value, source = "user", confidence = 1 } = req.body || {};
    const userId = req.user.id;
    if (!key || value === undefined) return res.status(400).json({ success: false, error: "key and value are required." });
    res.json({ success: true, memory: await memory.addMemory({ userId, type, key, value, source, confidence }) });
});

app.delete("/api/memory/:id", async (req, res) => {
    const ok = await memory.removeMemory(req.user.id, req.params.id);
    res.status(ok ? 200 : 404).json({ success: ok, error: ok ? null : "Memory not found." });
});

app.get("/api/conversations", async (req, res) => {
    const userId = req.user.id;
    res.json({ success: true, conversations: (await memory.history(userId, "default", 100)).slice(-100) });
});

app.get("/api/ai/metrics", async (req, res) => {
    const counts = await memory.counts(req.user.id);
    res.json({ success: true, metrics: metrics.snapshot(req.user.id), aiBudget: gateway.accountSnapshot(`${req.user.id}:default`), vectorStore: vectorStore.stats(), memory: counts });
});


// Shared AI compatibility endpoints. These route legacy UI calls through the Person 1 orchestrator.
app.post("/api/analysis", async (req, res) => {
    try {
        const { text, title = "Study Notes", sessionId = "default" } = req.body || {};
        const userId = req.user.id;
        if (!text || typeof text !== "string") return res.status(400).json({ success: false, error: "Text is required." });
        if (text.trim().length < 50) return res.status(400).json({ success: false, error: "Please provide at least 50 characters." });
        const documentId = createDocumentId();
        await rag.ingest({ documentId, documentName: title, documentType: "text", text, ownerId: userId, segments: [{ text, metadata: { sourceType: "text" } }] });
        const result = await orchestrator.planAndExecute({
            goal: `Generate a complete study pack from ${title}`,
            text, title, documentId, userId, sessionId, contextMode: "study"
        });
        metrics.request(true, req.user?.id);
        res.json({ ...result, title, documentId });
    } catch (error) { metrics.request(false, req.user?.id); aiError(res, error, "AI analysis failed."); }
});

app.post("/api/ask", async (req, res) => {
    try {
        const { question, documentId, sessionId = "default" } = req.body || {};
        const userId = req.user.id;
        if (!question || !String(question).trim()) return res.status(400).json({ success: false, error: "Question is required." });
        const plan = await orchestrator.plan({
            goal: String(question).trim(), hasDocument: Boolean(documentId),
            contextMode: documentId ? "document" : "general", userId, sessionId
        });
        const result = await orchestrator.execute({
            type: documentId ? "document_chat" : "chat",
            question: String(question).trim(), documentId, userId, sessionId,
            plan, contextMode: documentId ? "document" : "general"
        });
        res.json(result);
    } catch (error) { metrics.request(false, req.user?.id); aiError(res, error, "Failed to answer question."); }
});

// ============================================================
// GENERIC DOCUMENT UPLOAD / EXTRACTION
// ============================================================

app.post("/api/upload", async (req, res) => {
    try {
        const raw = req.files?.files || req.files?.file || req.files?.pdf;
        const files = !raw ? [] : Array.isArray(raw) ? raw : [raw];
        if (!files.length) return res.status(400).json({ success: false, error: "No study file uploaded." });
        if (files.length > 20) return res.status(400).json({ success: false, error: "Maximum 20 files per request." });

        const documents = [];
        const errors = [];
        for (const file of files) {
            try {
                const hydrated = await materializeUpload(file);
                const extracted = await extractUploadedFile(hydrated, { pdfParser: PDFParse, gateway });
                if (extracted.text.length < 40) throw new Error("Not enough readable text was found in this file.");
                documents.push({
                    documentId: createDocumentId(),
                    title: file.name,
                    type: extracted.type,
                    pages: extracted.pages || null,
                    characters: extracted.text.length,
                    text: extracted.text
                });
            } catch (error) {
                errors.push({ file: file.name, error: error.message || "Could not read this file." });
            }
        }

        if (!documents.length) return res.status(400).json({ success: false, error: errors[0]?.error || "No readable study material was found.", uploaded: 0, failed: errors.length, documents: [], errors });
        metrics.request(errors.length === 0, req.user?.id);
        return res.status(200).json({ success: true, uploaded: documents.length, failed: errors.length, documents, errors });
    } catch (error) {
        return aiError(res, error, "Study file extraction failed.");
    }
});

// ============================================================
// PRODUCTIVITY / TODO API (Person 3)
// ============================================================

const todoStore = new Map();

// Durable local JSON persistence for demo/development. Use a real database for multi-instance production.
const dataDir = path.join(__dirname, "data");
const stateFile = path.join(dataDir, "state.json");
fs.mkdirSync(dataDir, { recursive: true });

function loadPersistentState() {
    try {
        if (!fs.existsSync(stateFile)) return { todos: {}, rooms: {}, reminders: {}, emailTriage: {} };
        const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        return { todos: parsed.todos || {}, rooms: parsed.rooms || {}, reminders: parsed.reminders || {}, emailTriage: parsed.emailTriage || {} };
    } catch (error) {
        console.warn("⚠️ Could not load persistent state:", error.message);
        return { todos: {}, rooms: {}, reminders: {}, emailTriage: {} };
    }
}

let persistedState = loadPersistentState();
for (const [userId, todos] of Object.entries(persistedState.todos)) todoStore.set(userId, todos);
const reminderStore = new Map(Object.entries(persistedState.reminders || {}));
const emailTriageStore = new Map(Object.entries(persistedState.emailTriage || {}));

let stateWritePromise = Promise.resolve();
function buildPersistentStatePayload() {
    const roomsForDisk = {};
    const roomStore = typeof rooms !== "undefined" ? rooms : new Map();
    for (const [roomId, room] of roomStore.entries()) {
        roomsForDisk[roomId] = { ownerId: room.ownerId || null, inviteTokenHash: room.inviteTokenHash || null, allowedUsers: [...(room.allowedUsers || new Set())], messages: room.messages || [], notes: room.notes || "", documents: room.documents || [], quizzes: room.quizzes || [] };
    }
    return { todos: Object.fromEntries(todoStore.entries()), reminders: Object.fromEntries(reminderStore.entries()), emailTriage: Object.fromEntries(emailTriageStore.entries()), rooms: roomsForDisk };
}
function savePersistentState() {
    const payload = buildPersistentStatePayload();
    persistedState = payload;
    stateWritePromise = stateWritePromise.then(async () => {
        const serialized = JSON.stringify(payload, null, 2);
        const tempFile = `${stateFile}.tmp`;
        await fs.promises.writeFile(tempFile, serialized, "utf8");
        await fs.promises.rename(tempFile, stateFile);
        if (AppState && isDbConnected()) {
            await AppState.findOneAndUpdate({ key: "global" }, { key: "global", value: payload }, { upsert: true, new: true, setDefaultsOnInsert: true });
        }
    }).catch((error) => console.warn("⚠️ Persistent state save failed:", error.message));
    return stateWritePromise;
}
async function hydratePersistentStateFromMongo() {
    if (!AppState || !isDbConnected()) return;
    try {
        const record = await AppState.findOne({ key: "global" }).lean();
        if (!record?.value) return;
        persistedState = { todos: record.value.todos || {}, reminders: record.value.reminders || {}, emailTriage: record.value.emailTriage || {}, rooms: record.value.rooms || {} };
        todoStore.clear(); for (const [userId, todos] of Object.entries(persistedState.todos)) todoStore.set(userId, todos);
        reminderStore.clear(); for (const [userId, reminders] of Object.entries(persistedState.reminders)) reminderStore.set(userId, reminders);
        emailTriageStore.clear(); for (const [userId, items] of Object.entries(persistedState.emailTriage)) emailTriageStore.set(userId, items);
        if (typeof rooms !== "undefined") {
            rooms.clear();
            for (const [roomId, stored] of Object.entries(persistedState.rooms)) rooms.set(roomId, { ownerId: stored.ownerId || null, inviteTokenHash: stored.inviteTokenHash || null, allowedUsers: new Set(stored.allowedUsers || []), members: new Map(), messages: Array.isArray(stored.messages) ? stored.messages.slice(-100) : [], notes: String(stored.notes || ""), documents: Array.isArray(stored.documents) ? stored.documents.slice(-20) : [], quizzes: Array.isArray(stored.quizzes) ? stored.quizzes.slice(-10) : [] });
        }
        console.log("✅ MongoDB application state hydrated");
    } catch (error) { console.warn("⚠️ MongoDB application state hydration failed:", error.message); }
}


function normalizeTodo(input = {}) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return null;

    const now = new Date().toISOString();
    return {
        id: input.id || `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        description: typeof input.description === "string" ? input.description.trim() : "",
        dueDate: input.dueDate || null,
        priority: ["low", "medium", "high"].includes(input.priority) ? input.priority : "medium",
        completed: Boolean(input.completed),
        createdAt: input.createdAt || now,
        updatedAt: now
    };
}

app.get("/api/todos", (req, res) => {
    const userId = req.user.id;
    const todos = Array.from(todoStore.get(userId) || []);
    todos.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
    res.json({ success: true, todos });
});

app.post("/api/todos", (req, res) => {
    const userId = req.user.id;
    const todo = normalizeTodo(req.body);
    if (!todo) return res.status(400).json({ success: false, error: "A todo title is required." });
    const todos = todoStore.get(userId) || [];
    todos.push(todo);
    todoStore.set(userId, todos);
    savePersistentState();
    res.status(201).json({ success: true, todo });
});

app.patch("/api/todos/:id", (req, res) => {
    const userId = req.user.id;
    const todos = todoStore.get(userId) || [];
    const index = todos.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: "Todo not found." });
    const current = todos[index];
    const updated = normalizeTodo({ ...current, ...req.body, id: current.id, createdAt: current.createdAt });
    if (!updated) return res.status(400).json({ success: false, error: "A todo title is required." });
    todos[index] = updated;
    todoStore.set(userId, todos);
    savePersistentState();
    res.json({ success: true, todo: updated });
});

app.delete("/api/todos/:id", (req, res) => {
    const userId = req.user.id;
    const todos = todoStore.get(userId) || [];
    const next = todos.filter((item) => item.id !== req.params.id);
    if (next.length === todos.length) return res.status(404).json({ success: false, error: "Todo not found." });
    todoStore.set(userId, next);
    savePersistentState();
    res.json({ success: true });
});



app.get("/api/reminders", (req, res) => {
    const userId = req.user.id;
    const reminders = Array.isArray(reminderStore.get(userId)) ? reminderStore.get(userId) : [];
    res.json({ success: true, reminders: reminders.sort((a,b) => String(a.dueAt).localeCompare(String(b.dueAt))) });
});

app.post("/api/reminders", (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const dueAt = new Date(req.body?.dueAt || "");
    if (!title) return res.status(400).json({ success: false, error: "Reminder title is required." });
    if (Number.isNaN(dueAt.getTime())) return res.status(400).json({ success: false, error: "A valid reminder date/time is required." });
    if (dueAt.getTime() < Date.now() - 60_000) return res.status(400).json({ success: false, error: "Reminder time must be in the future." });
    const userId = req.user.id;
    const reminders = reminderStore.get(userId) || [];
    const reminder = { id: `rem_${crypto.randomUUID()}`, title, dueAt: dueAt.toISOString(), completed: false, createdAt: new Date().toISOString() };
    reminders.push(reminder); reminderStore.set(userId, reminders); savePersistentState();
    res.status(201).json({ success: true, reminder });
});

app.patch("/api/reminders/:id", (req, res) => {
    const reminders = reminderStore.get(req.user.id) || [];
    const item = reminders.find(x => x.id === req.params.id);
    if (!item) return res.status(404).json({ success: false, error: "Reminder not found." });
    if (req.body?.completed !== undefined) item.completed = Boolean(req.body.completed);
    savePersistentState(); res.json({ success: true, reminder: item });
});

app.delete("/api/reminders/:id", (req, res) => {
    const reminders = reminderStore.get(req.user.id) || [];
    const next = reminders.filter(x => x.id !== req.params.id);
    if (next.length === reminders.length) return res.status(404).json({ success: false, error: "Reminder not found." });
    reminderStore.set(req.user.id, next); savePersistentState(); res.json({ success: true });
});

app.get("/api/notifications/due", (req, res) => {
    const reminders = reminderStore.get(req.user.id) || [];
    const now = Date.now();
    const due = reminders.filter(x => !x.completed && new Date(x.dueAt).getTime() <= now + 30_000);
    res.json({ success: true, notifications: due.map(x => ({ id: x.id, title: x.title, dueAt: x.dueAt })) });
});

app.get("/api/productivity/health", (req, res) => {
    res.json({ success: true, service: "productivity", status: "ready", persistence: "json-file" });
});


// ============================================================
// INTEGRATIONS: GOOGLE (GMAIL + CALENDAR)
// ============================================================

const googleSessions = new Map();
const oauthStates = new Map();
global.smartStudyGoogleSessions = googleSessions;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/google/callback`;

const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GMAIL_SCOPES = [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE];
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function googleConfigured() {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function parseCookies(req) {
    const header = String(req.headers.cookie || "");
    return Object.fromEntries(header.split(";").map(part => part.trim()).filter(Boolean).map(part => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), (() => { try { return decodeURIComponent(part.slice(index + 1)); } catch { return ""; } })()];
    }));
}

function signSessionId(sid) {
    return crypto.createHmac("sha256", SESSION_SECRET).update(sid).digest("hex");
}

function verifySessionCookie(value) {
    const raw = String(value || "");
    const match = raw.match(/^([a-f0-9]{64})\.([a-f0-9]{64})$/i);
    if (!match) return null;
    const expected = signSessionId(match[1]);
    try {
        if (!crypto.timingSafeEqual(Buffer.from(match[2], "hex"), Buffer.from(expected, "hex"))) return null;
    } catch {
        return null;
    }
    return match[1];
}

function ensureSessionCookie(req, res) {
    if (req.smartStudySessionId) return req.smartStudySessionId;
    const cookies = parseCookies(req);
    let sid = verifySessionCookie(cookies["smart-study-sid"]);
    if (!sid) {
        sid = crypto.randomBytes(32).toString("hex");
        const value = `${sid}.${signSessionId(sid)}`;
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        res.setHeader("Set-Cookie", `smart-study-sid=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Priority=High${secure}`);
    }
    req.smartStudySessionId = sid;
    return sid;
}

function getSessionId(req, res) {
    return ensureSessionCookie(req, res);
}

function getSessionIdForRead(req) {
    return verifySessionCookie(parseCookies(req)["smart-study-sid"]);
}

function sendApiError(res, error, fallback = "Request failed.") {
    const status = Number(error?.status) || 500;
    let message = error?.message || fallback;
    let code = error?.code || null;
    if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message)) {
        code = code || "AI_QUOTA_EXHAUSTED";
        message = "The configured AI provider is temporarily out of quota or rate-limited. Retry later or configure another provider in Backend/.env.";
    }
    if (code === "AI_PROVIDER_UNAVAILABLE" || code === "NO_AI_PROVIDER") {
        message = "No configured AI provider is currently available. Add a valid GEMINI_API_KEY, OPENAI_API_KEY or GROQ_API_KEY to Backend/.env.";
    }
    if (code === "AI_BUDGET_EXCEEDED") {
        message = "The AI request was blocked because its estimated cost exceeds the remaining configured budget.";
    }
    res.status(status).json({ success: false, error: message, code, provider: error?.provider || null });
}

function isGeminiQuotaError(error) {
    return Number(error?.status) === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(String(error?.message || ""));
}

async function geminiGenerate(options) {
    try {
        return await ai.models.generateContent(options);
    } catch (error) {
        if (isGeminiQuotaError(error)) {
            error.status = 429;
            error.message = "Gemini quota/rate limit is currently exhausted. Wait for the quota to reset or use a Gemini project with available quota.";
        }
        throw error;
    }
}

function cryptoKey() { return crypto.createHash("sha256").update(String(GOOGLE_TOKEN_ENCRYPTION_KEY)).digest(); }
function encryptSecret(value) {
    if (!value) return null;
    const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", cryptoKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function decryptSecret(value) {
    if (!value) return null;
    try { const [ivRaw, tagRaw, dataRaw] = String(value).split("."); const decipher = crypto.createDecipheriv("aes-256-gcm", cryptoKey(), Buffer.from(ivRaw, "base64url")); decipher.setAuthTag(Buffer.from(tagRaw, "base64url")); return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8"); } catch { return null; }
}
async function persistGoogleIntegration(userId, session) {
    if (!GoogleIntegration || !isDbConnected() || !session?.access_token) return;
    await GoogleIntegration.findOneAndUpdate({ userId }, { userId, accessToken: encryptSecret(session.access_token), refreshToken: encryptSecret(session.refresh_token), expiresAt: session.expires_at ? new Date(session.expires_at) : null, scopes: session.scopes || [], updatedAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
async function loadGoogleIntegration(userId) {
    if (!GoogleIntegration || !isDbConnected()) return null;
    const record = await GoogleIntegration.findOne({ userId }).select("+accessToken +refreshToken").lean();
    if (!record?.accessToken) return null;
    return { userId: String(userId), access_token: decryptSecret(record.accessToken), refresh_token: decryptSecret(record.refreshToken), expires_at: record.expiresAt ? new Date(record.expiresAt).getTime() : null, scopes: record.scopes || [] };
}
async function clearGoogleIntegration(userId) {
    if (GoogleIntegration && isDbConnected()) await GoogleIntegration.deleteOne({ userId });
}

async function googleAccessToken(sessionId, userId) {
    let session = googleSessions.get(sessionId);
    if (session && String(session.userId) !== String(userId)) return null;
    if (!session) {
        session = await loadGoogleIntegration(userId);
        if (session) googleSessions.set(sessionId, session);
    }
    if (!session || String(session.userId) !== String(userId) || !session.access_token) return null;
    if (!session?.access_token) return null;

    if (session.expires_at && Date.now() > session.expires_at - 60000 && session.refresh_token) {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: session.refresh_token,
                grant_type: "refresh_token"
            })
        });
        const refreshed = await tokenResponse.json();
        if (!tokenResponse.ok) throw new Error(refreshed.error_description || refreshed.error || "Google token refresh failed.");
        session.access_token = refreshed.access_token;
        session.expires_at = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
        googleSessions.set(sessionId, session);
        await persistGoogleIntegration(userId, session);
    }

    return session.access_token;
}

async function googleApi(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
        const message = data?.error?.message || data?.error_description || data?.error || `Google API error (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return data;
}

function base64UrlDecode(value = "") {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
}

function extractGmailText(payload) {
    if (!payload) return "";
    if (payload.body?.data) return base64UrlDecode(payload.body.data);
    if (Array.isArray(payload.parts)) {
        for (const part of payload.parts) {
            const value = extractGmailText(part);
            if (value) return value;
        }
    }
    return "";
}

function getHeader(headers = [], name) {
    return headers.find(h => String(h.name).toLowerCase() === name.toLowerCase())?.value || "";
}

app.get("/api/integrations/status", (req, res) => {
    const sessionId = getSessionId(req, res);
    const session = googleSessions.get(sessionId);
    if (session && String(session.userId) !== String(req.user.id)) return res.json({ success: true, googleConfigured: googleConfigured(), connected: false, gmail: false, calendar: false, youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY) });
    res.json({
        success: true,
        googleConfigured: googleConfigured(),
        connected: Boolean(session?.access_token),
        gmail: Boolean(session?.scopes?.some(scope => GMAIL_SCOPES.includes(scope))),
        calendar: Boolean(session?.scopes?.includes(CALENDAR_SCOPE)),
        youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY)
    });
});

app.get("/api/google/auth", (req, res) => {
    if (!googleConfigured()) {
        return res.status(503).json({
            success: false,
            error: "Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to Backend/.env."
        });
    }

    const sessionId = getSessionId(req, res);
    const requested = String(req.query.service || "both").toLowerCase();
    const scopes = [];
    if (requested === "gmail" || requested === "both") scopes.push(...GMAIL_SCOPES);
    if (requested === "calendar" || requested === "both") scopes.push(CALENDAR_SCOPE);

    const state = crypto.randomBytes(24).toString("hex");
    oauthStates.set(state, {
        sessionId,
        userId: String(req.user.id),
        scopes,
        createdAt: Date.now()
    });

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: scopes.join(" "),
        state
    });

    res.json({
        success: true,
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    });
});

app.get("/api/google/callback", async (req, res) => {
    try {
        const stateData = oauthStates.get(String(req.query.state || ""));
        if (!stateData) return res.status(400).send("Invalid or expired OAuth state.");
        oauthStates.delete(String(req.query.state));

        if (req.query.error) return res.status(400).send(`Google authorization failed: ${req.query.error}`);

        const token = await googleApi("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: String(req.query.code || ""),
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: "authorization_code"
            })
        });

        const session = {
            userId: stateData.userId,
            ...token,
            expires_at: Date.now() + Number(token.expires_in || 3600) * 1000,
            scopes: stateData.scopes
        };
        googleSessions.set(stateData.sessionId, session);
        await persistGoogleIntegration(stateData.userId, session);

        res.redirect("/?google=connected");
    } catch (error) {
        console.error("Google OAuth callback error:", error);
        res.status(500).send(`Google connection failed: ${error.message}`);
    }
});

app.get("/api/gmail/messages", async (req, res) => {
    try {
        const sessionId = getSessionId(req, res);
        const token = await googleAccessToken(sessionId, req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Gmail first." });

        const maxResults = Math.min(Number(req.query.maxResults || 10), 25);
        const q = String(req.query.q || "");
        const params = new URLSearchParams({ maxResults: String(maxResults) });
        if (q) params.set("q", q);

        const list = await googleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const messages = await Promise.all((list.messages || []).map(async (item) => {
            const message = await googleApi(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return {
                id: message.id,
                threadId: message.threadId,
                subject: getHeader(message.payload?.headers, "Subject") || "(No subject)",
                from: getHeader(message.payload?.headers, "From"),
                to: getHeader(message.payload?.headers, "To"),
                date: getHeader(message.payload?.headers, "Date"),
                snippet: message.snippet || "",
                body: extractGmailText(message.payload).slice(0, 12000)
            };
        }));

        res.json({ success: true, messages });
    } catch (error) {
        console.error("Gmail messages error:", error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});



app.post("/api/gmail/triage", async (req, res) => {
    try {
        const token = await googleAccessToken(getSessionId(req, res), req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Gmail first." });
        const maxResults = Math.min(Number(req.body?.maxResults || 10), 20);
        const list = await googleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ maxResults: String(maxResults) })}`, { headers: { Authorization: `Bearer ${token}` } });
        const messages = await Promise.all((list.messages || []).map(async (item) => {
            const message = await googleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
            return { id: message.id, subject: getHeader(message.payload?.headers, "Subject") || "(No subject)", from: getHeader(message.payload?.headers, "From"), date: getHeader(message.payload?.headers, "Date"), body: extractGmailText(message.payload).slice(0, 10000) };
        }));
        const createdTodos = [], extracted = [];
        for (const message of messages) {
            const result = await aiJson(`You are an email-to-productivity agent for a student. Analyze the email. Return JSON only with keys category, summary, tasks (array of {title,priority,dueDate}), deadlines (array of {title,date,description}), actionRequired (boolean). Dates must be ISO 8601 when confidently inferable; otherwise null. Do not invent deadlines.\nSUBJECT:${message.subject}\nFROM:${message.from}\nDATE:${message.date}\nBODY:${message.body}`);
            const triage = { messageId: message.id, subject: message.subject, ...result };
            extracted.push(triage);
            const userId = req.user.id; const todos = todoStore.get(userId) || [];
            for (const task of Array.isArray(result.tasks) ? result.tasks.slice(0, 10) : []) {
                const todo = normalizeTodo({ title: task.title, dueDate: task.dueDate || null, priority: task.priority });
                if (todo && !todos.some(x => x.title.toLowerCase() === todo.title.toLowerCase() && !x.completed)) { todos.push(todo); createdTodos.push(todo); }
            }
            todoStore.set(userId, todos);
        }
        emailTriageStore.set(req.user.id, extracted.slice(0, 50)); savePersistentState();
        res.json({ success: true, processed: messages.length, extracted, createdTodos });
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }); }
});

app.get("/api/gmail/messages/:id", async (req, res) => {
    try {
        const token = await googleAccessToken(getSessionId(req, res), req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Gmail first." });
        const message = await googleApi(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(req.params.id)}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        res.json({
            success: true,
            message: {
                id: message.id,
                subject: getHeader(message.payload?.headers, "Subject"),
                from: getHeader(message.payload?.headers, "From"),
                to: getHeader(message.payload?.headers, "To"),
                date: getHeader(message.payload?.headers, "Date"),
                body: extractGmailText(message.payload)
            }
        });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

function toBase64Url(text) {
    return Buffer.from(text, "utf8").toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

app.post("/api/gmail/send", async (req, res) => {
    try {
        const token = await googleAccessToken(getSessionId(req, res), req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Gmail first." });

        const { to, subject = "", body = "" } = req.body || {};
        if (!to || !body) return res.status(400).json({ success: false, error: "Recipient and body are required." });
        if (String(to).length > 1000 || String(subject).length > 500 || String(body).length > 100000) {
            return res.status(400).json({ success: false, error: "Email content exceeds the allowed size." });
        }
        const recipients = String(to).split(",").map(value => value.trim()).filter(Boolean);
        if (!recipients.length || recipients.some(address => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) {
            return res.status(400).json({ success: false, error: "Enter valid recipient email address(es)." });
        }

        const raw = [
            `To: ${to}`,
            `Subject: ${String(subject).replace(/[\r\n]/g, " ")}`,
            "Content-Type: text/plain; charset=UTF-8",
            "",
            body
        ].join("\r\n");

        const sent = await googleApi("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw: toBase64Url(raw) })
        });

        res.json({ success: true, messageId: sent.id });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

// ============================================================
// CALENDAR
// ============================================================

app.get("/api/calendar/events", async (req, res) => {
    try {
        const token = await googleAccessToken(getSessionId(req, res), req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Google Calendar first." });

        const timeMin = String(req.query.timeMin || new Date().toISOString());
        const timeMax = String(req.query.timeMax || new Date(Date.now() + 30 * 86400000).toISOString());
        const params = new URLSearchParams({
            timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "100"
        });

        const data = await googleApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        res.json({
            success: true,
            events: (data.items || []).map(event => ({
                id: event.id,
                title: event.summary || "(Untitled)",
                description: event.description || "",
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                location: event.location || "",
                htmlLink: event.htmlLink || ""
            }))
        });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

app.post("/api/calendar/events", async (req, res) => {
    try {
        const token = await googleAccessToken(getSessionId(req, res), req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Google Calendar first." });

        const { title, description = "", start, end, location = "" } = req.body || {};
        if (!title || !start || !end) {
            return res.status(400).json({ success: false, error: "Title, start and end are required." });
        }
        if (String(title).length > 300) return res.status(400).json({ success: false, error: "Event title is too long." });
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return res.status(400).json({ success: false, error: "Start and end must be valid dates." });
        }
        if (endDate <= startDate) {
            return res.status(400).json({ success: false, error: "Event end time must be after the start time." });
        }

        const event = await googleApi("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                summary: title,
                description,
                location,
                start: { dateTime: startDate.toISOString() },
                end: { dateTime: endDate.toISOString() }
            })
        });

        res.status(201).json({ success: true, event: { id: event.id, title: event.summary, start: event.start?.dateTime, end: event.end?.dateTime } });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});



app.post("/api/gmail/triage-to-calendar", async (req, res) => {
    try {
        const token = await googleAccessToken(getSessionId(req, res), req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Google Calendar first." });
        const items = Array.isArray(req.body?.deadlines) ? req.body.deadlines.slice(0, 20) : [];
        const created = [];
        for (const item of items) {
            const start = new Date(item.date); if (Number.isNaN(start.getTime())) continue;
            const end = new Date(start.getTime() + 30 * 60 * 1000);
            const event = await googleApi("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ summary: item.title || "Email deadline", description: item.description || "Created from Smart Study AI email triage.", start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }) });
            created.push({ id: event.id, title: event.summary, start: event.start?.dateTime });
        }
        res.status(201).json({ success: true, created });
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }); }
});

app.delete("/api/calendar/events/:id", async (req, res) => {
    try {
        const token = await googleAccessToken(getSessionId(req, res), req.user.id);
        if (!token) return res.status(401).json({ success: false, error: "Connect Google Calendar first." });
        await googleApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(req.params.id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

// ============================================================
// RESEARCH: GEMINI + GOOGLE SEARCH GROUNDING
// ============================================================

async function liveWebSearchFallback(query) {
    const encoded = encodeURIComponent(String(query || "").trim());
    const urls = [
        `https://html.duckduckgo.com/html/?q=${encoded}`,
        `https://www.google.com/search?q=${encoded}`
    ];

    const decodeHtml = (value) => String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; SmartStudyAI/1.0; +https://example.com)"
                },
                signal: AbortSignal.timeout(7000)
            });
            if (!response.ok) continue;
            const html = await response.text();
            const results = [];

            // DuckDuckGo HTML result format. Keep this deliberately dependency-free.
            const ddgPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>|$)/gi;
            let match;
            while ((match = ddgPattern.exec(html)) && results.length < 6) {
                const link = decodeHtml(match[1]);
                const title = decodeHtml(match[2]);
                const snippet = decodeHtml(match[3] || "");
                if (/^https?:\/\//i.test(link) && title) results.push({ title, url: link, snippet });
            }

            // Google fallback parser. Google may change markup, so only use obvious absolute links.
            if (!results.length) {
                const googlePattern = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
                while ((match = googlePattern.exec(html)) && results.length < 6) {
                    const link = decodeHtml(match[1]);
                    const title = decodeHtml(match[2]);
                    if (!title || /google\.(com|co\.|in)/i.test(link) || /webcache|translate/i.test(link)) continue;
                    if (!results.some(x => x.url === link)) results.push({ title, url: link, snippet: "" });
                }
            }

            if (results.length) return results;
        } catch (error) {
            console.warn("Live web fallback failed:", error?.message || error);
        }
    }
    return [];
}

app.post("/api/research", async (req, res) => {
    try {
        const query = String(req.body?.query || "").trim();
        if (!query) return res.status(400).json({ success: false, error: "Research query is required." });
        if (query.length > 500) return res.status(400).json({ success: false, error: "Research query must be 500 characters or less." });

        try {
            const response = await gateway.generate({
                provider: "gemini",
                model: gateway.defaultModel("gemini"),
                task: "research",
                prompt: `Research this topic for a student using current public web information. Answer concisely and factually. Cite the web sources in the answer when possible. Topic: ${query}`,
                tools: [{ googleSearch: {} }],
                json: false,
                maxRetries: 0,
                userId: req.user.id,
                sessionId: "research",
                budgetKey: `${req.user.id}:research`
            });

            const sources = Array.isArray(response.sources) ? response.sources : [];
            if (String(response.text || "").trim()) {
                return res.json({ success: true, query, provider: response.provider || "gemini", model: response.model || null, answer: response.text, sources, citations: response.citations || null, estimatedCostUsd: response.estimatedCostUsd || 0, grounded: sources.length > 0 });
            }
        } catch (error) {
            console.warn("[Research] Gemini grounding unavailable; using live web search fallback:", error?.message || error);
        }

        const sources = await liveWebSearchFallback(query);
        if (!sources.length) {
            return res.status(503).json({
                success: false,
                error: "Live web search is temporarily unavailable. Check the server internet connection and try Research again.",
                code: "LIVE_WEB_UNAVAILABLE"
            });
        }

        const sourceText = sources.slice(0, 6).map((item, index) => `[${index + 1}] ${item.title}\n${item.snippet || ""}\n${item.url}`).join("\n\n");
        const answer = `Live web results for **${query}**\n\n${sources.slice(0, 6).map((item, index) => `**${index + 1}. ${item.title}**\n${item.snippet || "Open the source for the full result."}`).join("\n\n")}`;
        return res.json({ success: true, query, provider: "live-web-search", model: null, answer, sources, citations: sources.map((x, i) => ({ index: i + 1, url: x.url, title: x.title })), grounded: true, sourceText });
    } catch (error) {
        console.error("Research error:", error);
        return sendApiError(res, error, "Research failed.");
    }
});

// ============================================================
// EDUCATIONAL VIDEO SEARCH
// ============================================================

app.get("/api/videos", async (req, res) => {
    try {
        const query = String(req.query.q || "").trim();
        if (!query) return res.status(400).json({ success: false, error: "Video search query is required." });
        if (query.length > 200) return res.status(400).json({ success: false, error: "Video search query must be 200 characters or less." });

        const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} educational`)}`;

        if (process.env.YOUTUBE_API_KEY) {
            const params = new URLSearchParams({
                part: "snippet",
                q: `${query} educational`,
                type: "video",
                maxResults: "8",
                safeSearch: "strict",
                videoEmbeddable: "true",
                key: process.env.YOUTUBE_API_KEY
            });
            const data = await googleApi(`https://www.googleapis.com/youtube/v3/search?${params}`);
            const videos = (data.items || []).map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                channel: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`
            }));
            return res.json({ success: true, provider: "youtube", videos, searchUrl: youtubeSearchUrl });
        }

        // Video discovery must not consume Gemini quota. Return a reliable YouTube search fallback.
        return res.json({
            success: true,
            provider: "youtube-search-fallback",
            videos: [],
            searchUrl: youtubeSearchUrl,
            note: "Add YOUTUBE_API_KEY for in-app video cards and embeds. You can still open the YouTube educational search directly without Gemini."
        });
    } catch (error) {
        console.error("Video search error:", error);
        res.status(error.status || 500).json({ success: false, error: error.message || "Video search failed." });
    }
});

// ============================================================
// CODING / INTERVIEW / RESUME AI
// ============================================================

async function aiJson(prompt) {
    try {
        const response = await gateway.generateSlot("synthesizer", {
            prompt, json: true, maxRetries: 0
        });
        const text = String(response?.text || "{}").trim();
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        try { return JSON.parse(cleaned); }
        catch {
            const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
            if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
            throw new Error("AI returned an invalid JSON response.");
        }
    } catch (error) {
        console.warn("[aiJson] External AI unavailable; using local fallback:", error?.message || error);
        return localAiJson(prompt);
    }
}



app.post("/api/videos/generate", async (req, res) => {
    try {
        const topic = String(req.body?.topic || "").trim();
        const material = String(req.body?.material || "").trim();
        const language = String(req.body?.language || "English").trim();
        if (!topic && !material) return res.status(400).json({ success: false, error: "Topic or study material is required." });
        const result = await aiJson(`Create a self-contained educational micro-video lesson. Return JSON only with title, learningObjectives (array), script, slides (array of {title,body,visualPrompt,durationSeconds}), quiz (array of {question,options,answer}), narration (array of strings). Use language ${language}. Topic: ${topic}. Study material: ${material.slice(0,30000)}. Keep it accurate and student-friendly.`);
        let externalVideo = null;
        if (process.env.VIDEO_API_URL) {
            try {
                const response = await fetch(process.env.VIDEO_API_URL, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.VIDEO_API_KEY ? { Authorization: `Bearer ${process.env.VIDEO_API_KEY}` } : {}) }, body: JSON.stringify({ topic, language, lesson: result }) });
                if (response.ok) externalVideo = await response.json();
            } catch (videoError) { console.warn("Optional external video API unavailable:", videoError.message); }
        }
        const normalized = { id: `lesson_${crypto.randomUUID()}`, ...result, externalVideo, createdAt: new Date().toISOString(), format: externalVideo ? "external-video" : "interactive-video-lesson", tts: "browser-speech-synthesis" };
        res.status(201).json({ success: true, lesson: normalized });
    } catch (error) { sendApiError(res, error, "Educational video generation failed."); }
});

app.post("/api/coding/solve", async (req, res) => {
    try {
        const { problem = "", language = "JavaScript", code = "" } = req.body || {};
        if (!problem.trim() && !code.trim()) return res.status(400).json({ success: false, error: "Problem or code is required." });
        let codeContext = "";
        try {
            const ragResults = await rag.retrieve(`${problem} ${code}`.slice(0, 12000), { topK: 4, ownerId: req.user.id });
            codeContext = rag.buildContext(ragResults);
        } catch {}
        const result = await aiJson(`You are a senior developer and coding mentor.
Return JSON with keys: explanation, approach (array of strings), solution, complexity, testCases (array), debuggingNotes (array).
Language: ${language}
Problem: ${problem}
Existing code: ${code}
Relevant indexed project context:
${codeContext || "none"}
Explain clearly and do not claim code was executed unless execution results are supplied.`);
        res.json({ success: true, result });
    } catch (error) {
        sendApiError(res, error, "Coding assistant failed.");
    }
});



app.post("/api/coding/run", async (req, res) => {
    if (process.env.ENABLE_CODE_EXECUTION !== "true") return res.status(503).json({ success: false, error: "Code execution is disabled. Set ENABLE_CODE_EXECUTION=true only when a sandbox is configured." });
    const mode = String(process.env.CODE_EXECUTION_MODE || "docker").toLowerCase();
    if (mode === "process" && process.env.ALLOW_UNSANDBOXED_CODE !== "true") return res.status(503).json({ success: false, error: "Unsafe process execution is blocked. Configure Docker sandboxing or explicitly enable local unsandboxed execution." });
    const language = String(req.body?.language || "JavaScript");
    const code = String(req.body?.code || "");
    if (!code.trim()) return res.status(400).json({ success: false, error: "Code is required." });
    if (code.length > 30000) return res.status(400).json({ success: false, error: "Code is too large." });
    const configs = {
        javascript: { image: process.env.CODE_NODE_IMAGE || "node:22-alpine", command: "node", ext: "js" },
        node: { image: process.env.CODE_NODE_IMAGE || "node:22-alpine", command: "node", ext: "js" },
        python: { image: process.env.CODE_PYTHON_IMAGE || "python:3.12-alpine", command: "python3", ext: "py" },
        python3: { image: process.env.CODE_PYTHON_IMAGE || "python:3.12-alpine", command: "python3", ext: "py" },
        cpp: { image: process.env.CODE_CPP_IMAGE || "gcc:14", command: "g++", ext: "cpp" },
        "c++": { image: process.env.CODE_CPP_IMAGE || "gcc:14", command: "g++", ext: "cpp" }
    };
    const key = language.toLowerCase(); const cfg = configs[key];
    if (!cfg) return res.status(400).json({ success: false, error: "Supported execution languages: JavaScript, Node, Python and C++." });
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "smart-study-run-"));
    const source = path.join(tempDir, `main.${cfg.ext}`); await fs.promises.writeFile(source, code, "utf8");
    try {
        let result;
        if (mode === "docker") {
            const dockerArgs = ["run", "--rm", "--network", "none", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "65532:65532", "--cpus", process.env.CODE_CPU_LIMIT || "0.5", "--memory", process.env.CODE_MEMORY_LIMIT || "256m", "--pids-limit", process.env.CODE_PIDS_LIMIT || "64", "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "-v", `${tempDir}:/workspace:ro`, "-w", "/workspace", cfg.image];
            if (cfg.ext === "cpp") {
                dockerArgs.push("sh", "-lc", "g++ -std=c++17 /workspace/main.cpp -o /tmp/a.out && /tmp/a.out");
            } else dockerArgs.push(cfg.command, `/workspace/main.${cfg.ext}`);
            result = await execFileAsync("docker", dockerArgs, { timeout: 7000, maxBuffer: 1_000_000, env: { PATH: process.env.PATH || "" } });
        } else {
            const configsLocal = { javascript: { command: process.execPath, args: [] }, node: { command: process.execPath, args: [] }, python: { command: process.env.PYTHON_BIN || "python3", args: [] }, python3: { command: process.env.PYTHON_BIN || "python3", args: [] }, cpp: { command: "g++", args: ["-std=c++17"] }, "c++": { command: "g++", args: ["-std=c++17"] } };
            const local = configsLocal[key]; let command = local.command, args = [...local.args, source];
            if (cfg.ext === "cpp") { const executable = path.join(tempDir, "a.out"); await execFileAsync(command, [...local.args, source, "-o", executable], { timeout: 5000, maxBuffer: 1_000_000 }); command = executable; args = []; }
            result = await execFileAsync(command, args, { timeout: 5000, maxBuffer: 1_000_000, cwd: tempDir, env: { PATH: process.env.PATH, HOME: tempDir, TMPDIR: tempDir } });
        }
        res.json({ success: true, executed: true, sandbox: mode, stdout: result.stdout || "", stderr: result.stderr || "", exitCode: 0 });
    } catch (error) {
        if (mode === "docker" && /not found|ENOENT|Cannot connect to the Docker daemon/i.test(String(error?.message || ""))) return res.status(503).json({ success: false, error: "Docker sandbox is unavailable. Start Docker or use an explicitly enabled local development runner." });
        res.json({ success: true, executed: true, sandbox: mode, stdout: error.stdout || "", stderr: error.stderr || error.message || "Execution failed.", exitCode: Number.isInteger(error.code) ? error.code : 1, timedOut: /timed out/i.test(error.message || "") });
    } finally { await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {}); }
});

app.post("/api/interview/question", async (req, res) => {
    const { role = "Software Engineer", level = "entry", topic = "general" } = req.body || {};
    try {
        const result = await aiJson(`Create EXACTLY 5 realistic interview questions for a ${level}-level ${role} candidate about ${topic}. Return JSON only: {"questions":[{"question":"string","type":"technical|behavioral|scenario|problem-solving","evaluationCriteria":["string"],"modelAnswer":"string","followUps":["string"]}]} Rules: exactly 5 distinct questions; relevant to the role, level and topic.`);
        let questions = Array.isArray(result?.questions) ? result.questions : [];
        if (!questions.length && result?.question) questions = [result];
        if (questions.length < 5) throw new Error(`Interview generator returned only ${questions.length} questions.`);
        questions = questions.slice(0, 5).map((item, index) => ({ question: String(item?.question || "").trim(), type: String(item?.type || "Interview question").trim(), evaluationCriteria: Array.isArray(item?.evaluationCriteria) ? item.evaluationCriteria : [], modelAnswer: String(item?.modelAnswer || "").trim(), followUps: Array.isArray(item?.followUps) ? item.followUps : [], number: index + 1 })).filter(x => x.question);
        if (questions.length < 5) throw new Error("Interview generator returned fewer than 5 valid questions.");
        res.json({ success: true, result: { questions }, provider: "external-ai" });
    } catch (error) {
        console.warn("[Interview] External AI unavailable; using local interview engine:", error?.message || error);
        res.json({ success: true, result: localInterviewQuestions({ role, level, topic }), provider: "local-fallback", fallback: true });
    }
});

app.post("/api/interview/evaluate", async (req, res) => {
    const { question = "", answer = "", role = "Software Engineer" } = req.body || {};
    if (!String(question).trim() || !String(answer).trim()) return res.status(400).json({ success: false, error: "Question and answer are required." });
    try {
        const result = await aiJson(`Evaluate this interview answer for a ${role} candidate. Return JSON with keys: strengths (array), improvements (array), scoreOutOf10 (number), improvedAnswer, followUpQuestion. Question: ${question} Candidate answer: ${answer}`);
        res.json({ success: true, result, provider: result?.provider === "local-fallback" ? "local-fallback" : "external-ai", fallback: result?.provider === "local-fallback" });
    } catch (error) {
        console.warn("[Interview] External evaluation unavailable; using local evaluator:", error?.message || error);
        res.json({ success: true, result: localEvaluateInterview({ question, answer, role }), provider: "local-fallback", fallback: true });
    }
});

app.post("/api/resume/review", async (req, res) => {
    try {
        const { resume = "", targetRole = "" } = req.body || {};
        const resumeText = String(resume).trim();
        if (!resumeText) return res.status(400).json({ success: false, error: "Resume text is required." });

        const result = await aiJson(`Act as a strict ATS resume evaluator.

Target role: ${targetRole || "unspecified"}

Evaluate the resume below based ONLY on the supplied resume content. Do not invent experience, employers, degrees, dates, metrics, certifications, skills or achievements.

Return JSON only:
{
  "summary": "2-4 sentence evaluation",
  "overallScore": 0,
  "atsScore": 0,
  "strengths": ["..."],
  "gaps": ["..."],
  "atsKeywords": ["..."],
  "rewrittenBullets": ["..."],
  "formattingIssues": ["..."],
  "roleMatch": ["..."],
  "nextSteps": ["..."]
}

Scoring:
- overallScore and atsScore must be numbers from 0 to 100.
- Base the scores on evidence in the resume.
- Explain the most important reasons in strengths/gaps/nextSteps.
- Keep rewritten bullets truthful and do not add unsupported metrics.

Resume:
${resumeText.slice(0, 50000)}`);

        res.json({ success: true, result });
    } catch (error) {
        sendApiError(res, error, "Resume evaluation failed.");
    }
});



app.post("/api/study-plan/adaptive", async (req, res) => {
    try {
        const examDate = new Date(req.body?.examDate || "");
        const subjects = Array.isArray(req.body?.subjects) ? req.body.subjects.map(String).map(x => x.trim()).filter(Boolean).slice(0, 20) : [];
        const weakTopics = Array.isArray(req.body?.weakTopics) ? req.body.weakTopics.map(String).map(x => x.trim()).filter(Boolean).slice(0, 50) : [];
        const availableHours = Number(req.body?.availableHours ?? req.body?.hoursPerDay ?? 2);
        const goal = String(req.body?.goal || "Prepare effectively for the exam").trim();
        if (Number.isNaN(examDate.getTime())) return res.status(400).json({ success: false, error: "A valid exam date is required." });
        if (!subjects.length) return res.status(400).json({ success: false, error: "Add at least one subject." });
        if (!Number.isFinite(availableHours) || availableHours <= 0 || availableHours > 24) return res.status(400).json({ success: false, error: "Available hours must be between 0 and 24." });
        const days = Math.max(1, Math.min(120, Math.ceil((examDate.getTime() - Date.now()) / 86400000)));
        const result = await aiJson(`Create an adaptive student study plan. Return JSON only with overview, priorities (array), days (array of {day,date,subject,topic,tasks,durationMinutes,reason,checkpoint}).\nExam date: ${examDate.toISOString()}\nDays remaining: ${days}\nSubjects: ${subjects.join(", ")}\nWeak topics: ${weakTopics.join(", ") || "none known"}\nAvailable hours/day: ${availableHours}\nGoal: ${goal}\nPrioritize weak topics, use spaced review, reserve final days for mixed practice and revision, and never schedule more than the available daily minutes.`);
        let saved = null;
        if (learningRoutesAvailable) {
            const items = Array.isArray(result.days) ? result.days.slice(0, days).map((d, i) => ({ title: `${d.subject || "Study"}: ${d.topic || "Revision"}`, subject: d.subject || "General", topic: d.topic || "General", date: new Date(d.date || Date.now() + i * 86400000), duration: Math.min(Number(d.durationMinutes) || Math.round(availableHours * 60), Math.round(availableHours * 60)), priority: weakTopics.some(w => String(d.topic || "").toLowerCase().includes(w.toLowerCase())) ? "high" : "medium", status: "pending" })) : [];
            saved = await StudyPlan.create({ userId: req.user.id, title: `Adaptive plan: ${goal.slice(0, 120)}`, goal, subject: subjects[0], topics: [...new Set([...subjects, ...weakTopics])], durationDays: days, startDate: new Date(), endDate: examDate, dailyTarget: Math.round(availableHours * 60), priority: "high", status: "active", items });
        }
        res.status(201).json({ success: true, adaptive: true, daysRemaining: days, result, savedPlan: saved });
    } catch (error) { sendApiError(res, error, "Adaptive study plan generation failed."); }
});

app.post("/api/study-plan", async (req, res) => {
    try {
        const { goal = "", days = 7, hoursPerDay = 2 } = req.body || {};
        if (!goal.trim()) return res.status(400).json({ success: false, error: "Study goal is required." });
        const result = await aiJson(`Create a practical study plan.
Goal: ${goal}
Days: ${days}
Hours per day: ${hoursPerDay}
Return JSON with keys: overview and days, where days is an array of objects with day, focus, tasks (array), durationMinutes, milestone.`);
        res.json({ success: true, result });
    } catch (error) {
        sendApiError(res, error, "Study plan generation failed.");
    }
});

// ============================================================
// SHARED STUDY ROOMS (WEBSOCKET)
// ============================================================

const rooms = new Map();
for (const [roomId, stored] of Object.entries(persistedState.rooms || {})) {
    rooms.set(roomId, { ownerId: stored.ownerId || null, inviteTokenHash: stored.inviteTokenHash || null, allowedUsers: new Set(stored.allowedUsers || []), members: new Map(), messages: Array.isArray(stored.messages) ? stored.messages.slice(-100) : [], notes: String(stored.notes || ""), documents: Array.isArray(stored.documents) ? stored.documents.slice(-20) : [], quizzes: Array.isArray(stored.quizzes) ? stored.quizzes.slice(-10) : [] });
}

function roomSnapshot(roomId) {
    const room = rooms.get(roomId) || { members: new Map(), messages: [], notes: "", documents: [], quizzes: [] };
    return {
        roomId,
        members: [...room.members.values()].map(({ id, name }) => ({ id, name })),
        messages: room.messages.slice(-100),
        notes: room.notes,
        documents: room.documents || [],
        quizzes: room.quizzes || []
    };
}

function broadcastRoom(roomId, payload) {
    const room = rooms.get(roomId);
    if (!room) return;
    const encoded = JSON.stringify(payload);
    for (const member of room.members.values()) {
        if (member.ws.readyState === 1) member.ws.send(encoded);
    }
}

function hashRoomInvite(token) { return crypto.createHash("sha256").update(String(token)).digest("hex"); }
function validRoomInvite(token, expectedHash) {
    const actual = Buffer.from(hashRoomInvite(token), "hex");
    const expected = Buffer.from(String(expectedHash || ""), "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

app.post("/api/rooms", (req, res) => {
    const roomId = crypto.randomBytes(8).toString("hex").toUpperCase();
    const inviteToken = crypto.randomBytes(32).toString("hex");
    rooms.set(roomId, { ownerId: req.user.id, inviteTokenHash: hashRoomInvite(inviteToken), allowedUsers: new Set([req.user.id]), members: new Map(), messages: [], notes: "", documents: [], quizzes: [] });
    savePersistentState();
    res.status(201).json({ success: true, roomId, inviteToken });
});

app.post("/api/rooms/:roomId/join", (req, res) => {
    const roomId = String(req.params.roomId).toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ success: false, error: "Room not found." });
    room.allowedUsers = room.allowedUsers || new Set();
    if (room.ownerId !== req.user.id) {
        const inviteToken = String(req.body?.inviteToken || "");
        if (!room.inviteTokenHash || !inviteToken || !validRoomInvite(inviteToken, room.inviteTokenHash)) {
            return res.status(403).json({ success: false, error: "A valid study-room invite token is required." });
        }
    }
    room.allowedUsers.add(req.user.id);
    savePersistentState();
    res.json({ success: true, roomId, joined: true });
});

app.get("/api/rooms/:roomId", (req, res) => {
    const roomId = String(req.params.roomId).toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ success: false, error: "Room not found." });
    if (room.ownerId && room.ownerId !== req.user.id && !room.allowedUsers?.has(req.user.id)) return res.status(403).json({ success: false, error: "You are not a member of this study room." });
    res.json({ success: true, room: roomSnapshot(roomId) });
});



app.post("/api/rooms/:roomId/documents", async (req, res) => {
    const roomId = String(req.params.roomId).toUpperCase(); const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ success: false, error: "Room not found." });
    if (room.ownerId && room.ownerId !== req.user.id && !room.allowedUsers?.has(req.user.id)) return res.status(403).json({ success: false, error: "Join this study room before using its shared workspace." });
    const documentId = String(req.body?.documentId || ""); const title = String(req.body?.title || "Shared document").trim();
    if (!documentId) return res.status(400).json({ success: false, error: "documentId is required." });
    const docs = room.documents || (room.documents = []); if (!docs.some(x => x.documentId === documentId)) docs.push({ documentId, title, addedBy: req.user.id, addedAt: new Date().toISOString() });
    room.documents = docs.slice(-20); savePersistentState(); broadcastRoom(roomId, { type: "documents", documents: room.documents }); res.json({ success: true, documents: room.documents });
});

app.post("/api/rooms/:roomId/quizzes", async (req, res) => {
    const roomId = String(req.params.roomId).toUpperCase(); const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ success: false, error: "Room not found." });
    if (room.ownerId && room.ownerId !== req.user.id && !room.allowedUsers?.has(req.user.id)) return res.status(403).json({ success: false, error: "Join this study room before using its shared workspace." });
    const topic = String(req.body?.topic || "General study").slice(0, 200); const count = Math.min(10, Math.max(3, Number(req.body?.count) || 5));
    const result = await aiJson(`Create a collaborative quiz about ${topic}. Return JSON with questions array. Each question must have question, options (4 strings), answer, explanation, difficulty, topic.`);
    const quiz = { id: `quiz_${crypto.randomUUID()}`, topic, createdBy: req.user.id, createdAt: new Date().toISOString(), questions: Array.isArray(result.questions) ? result.questions.slice(0, count) : [] };
    room.quizzes = [...(room.quizzes || []), quiz].slice(-10); savePersistentState(); broadcastRoom(roomId, { type: "quizzes", quizzes: room.quizzes }); res.status(201).json({ success: true, quiz });
});

app.post("/api/rooms/:roomId/tutor", async (req, res) => {
    const roomId = String(req.params.roomId).toUpperCase(); const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ success: false, error: "Room not found." });
    if (room.ownerId && room.ownerId !== req.user.id && !room.allowedUsers?.has(req.user.id)) return res.status(403).json({ success: false, error: "Join this study room before using its AI tutor." });
    const question = String(req.body?.question || "").trim(); if (!question) return res.status(400).json({ success: false, error: "Question is required." });
    const context = `ROOM NOTES:\n${room.notes || "none"}\nSHARED DOCUMENTS:\n${(room.documents || []).map(x => `${x.title} (${x.documentId})`).join(", ") || "none"}\nRECENT GROUP CHAT:\n${room.messages.slice(-20).map(x => `${x.name}: ${x.text}`).join("\n")}`;
    const answer = await aiJson(`You are the AI tutor inside a collaborative study room. Answer the question using the room context. Return JSON with answer, keyPoints (array), followUp (string).\nQUESTION:${question}\n${context}`);
    res.json({ success: true, answer });
});

const { WebSocketServer } = require("ws");

function setupStudyRoomSocket(server) {
    const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });
    wss.on("connection", (ws, req) => {
        const origin = String(req.headers.origin || "");
        if (origin && !allowedOrigins.has(origin)) return ws.close(1008, "Origin not allowed.");
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const roomId = String(url.searchParams.get("room") || "").toUpperCase();
        const name = String(url.searchParams.get("name") || "Student").slice(0, 40);
        if (!roomId) return ws.close(1008, "Room required.");
        if (!rooms.has(roomId)) return ws.close(1008, "Room not found.");
        if (!process.env.JWT_SECRET) return ws.close(1011, "Authentication unavailable.");

        let authenticated = false;
        let userId = null;
        let memberId = null;
        const authTimeout = setTimeout(() => { if (!authenticated) ws.close(1008, "Authentication required."); }, 5000);
        const authenticateSocket = (accessToken) => {
            try {
                const decoded = jwt.verify(String(accessToken || ""), process.env.JWT_SECRET);
                userId = String(decoded.id);
            } catch { return false; }
            const room = rooms.get(roomId);
            room.allowedUsers = room.allowedUsers || new Set();
            if (!room.allowedUsers.has(userId)) return false;
            if (room.members.size >= 25) return false;
            authenticated = true;
            clearTimeout(authTimeout);
            memberId = crypto.randomBytes(6).toString("hex");
            room.members.set(memberId, { id: memberId, name, ws, userId });
            ws.send(JSON.stringify({ type: "snapshot", room: roomSnapshot(roomId) }));
            broadcastRoom(roomId, { type: "members", members: roomSnapshot(roomId).members });
            return true;
        };

        ws.on("message", raw => {
            try {
                const message = JSON.parse(raw.toString());
                if (!authenticated) {
                    if (message.type !== "auth" || !authenticateSocket(message.token)) return ws.close(1008, "Valid authentication token required.");
                    return;
                }
                const room = rooms.get(roomId);
                if (!room) return ws.close(1008, "Room not found.");
                if (message.type === "chat") {
                    const item = { id: crypto.randomBytes(6).toString("hex"), name, text: String(message.text || "").slice(0, 2000), at: new Date().toISOString() };
                    if (!item.text.trim()) return;
                    room.messages.push(item); room.messages = room.messages.slice(-100); savePersistentState();
                    broadcastRoom(roomId, { type: "chat", message: item });
                }
                if (message.type === "notes") {
                    room.notes = String(message.notes || "").slice(0, 20000); savePersistentState();
                    broadcastRoom(roomId, { type: "notes", notes: room.notes, by: name });
                }
            } catch { ws.close(1003, "Invalid message."); }
        });
        ws.on("close", () => {
            clearTimeout(authTimeout);
            if (memberId) { const room = rooms.get(roomId); if (room) { room.members.delete(memberId); broadcastRoom(roomId, { type: "members", members: roomSnapshot(roomId).members }); } }
        });
    });
}

setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [state, data] of oauthStates.entries()) if (data.createdAt < cutoff) oauthStates.delete(state);
    const rateCutoff = Date.now() - 2 * 60 * 1000;
    for (const [key, bucket] of rateBuckets.entries()) if (bucket.startedAt < rateCutoff) rateBuckets.delete(key);
}, 60 * 1000).unref();

// ============================================================
// SERVER START
// ============================================================

// ============================================================
// UNKNOWN API ROUTE
// ============================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            error:
                `API route not found: ${req.method} ${req.originalUrl}`

        });

    }
);


const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// ============================================================
// SERVE FRONTEND
// ============================================================

app.use(
    express.static(
        frontendPath
    )
);


// ============================================================
// FRONTEND FALLBACK
// ============================================================



app.get(
    /.*/,
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "index.html"
            )
        );

    }
);


// ============================================================
// START SERVER
// ============================================================

const server = http.createServer(app);
setupStudyRoomSocket(server);

server.listen(PORT, () => {
    console.log("");
    console.log("==========================================");
    console.log("🚀 SMART STUDY AI ASSISTANT");
    console.log("==========================================");
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`❤️ http://localhost:${PORT}/api/health`);
    console.log(`🤝 Study rooms: ws://localhost:${PORT}/ws`);
    console.log("💾 Storage: MongoDB application state when configured; local JSON fallback for development");
    console.log("🧠 Gemini: Configured");
    console.log("==========================================");
    console.log("");
});




