function getCore() {
    const core = global.smartStudyAI;
    if (!core?.orchestrator) {
        const error = new Error("Person 1 AI Orchestrator is not initialized.");
        error.statusCode = 503;
        throw error;
    }
    return core.orchestrator;
}

async function run(payload = {}) {
    const orchestrator = getCore();
    const task = String(payload.task || "chat");

    if (task === "analysis" || task === "study_plan") {
        const result = await orchestrator.planAndExecute({
            goal: `Generate a study plan or study pack for ${payload.title || "the supplied material"}`,
            text: payload.message || payload.text || "",
            title: payload.title || "Study Notes",
            documentId: payload.documentId,
            userId: payload.userId || "anonymous",
            sessionId: payload.sessionId || "default",
            contextMode: "study"
        });
        return result;
    }

    const question = payload.message || payload.question || payload.goal || "";
    const mode = payload.mode || "normal";
    const plan = await orchestrator.plan({
        goal: String(question),
        hasDocument: Boolean(payload.documentId),
        contextMode: payload.documentId ? "document" : "general",
        userId: payload.userId || "anonymous",
        sessionId: payload.sessionId || "default"
    });
    return orchestrator.execute({
        type: payload.documentId ? "document_chat" : "chat",
        question: String(question),
        documentId: payload.documentId,
        userId: payload.userId || "anonymous",
        sessionId: payload.sessionId || "default",
        contextMode: payload.documentId ? "document" : "general",
        plan,
        tutorMode: mode
    });
}

module.exports = { run };
