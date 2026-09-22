const orchestrator = require("../ai/orchestrator");

async function runSharedAI(payload) {
    if (!orchestrator || typeof orchestrator.run !== "function") {
        const error = new Error("Person 1 AI Orchestrator contract is unavailable.");
        error.statusCode = 503;
        throw error;
    }
    return orchestrator.run(payload);
}

module.exports = { runSharedAI };
