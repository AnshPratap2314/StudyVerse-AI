const StudySession = require("../models/StudySession");
const { buildAdaptiveRecommendation } = require("../services/adaptiveLearningService");

async function recommendation(req, res) {
  try {
    const data = await buildAdaptiveRecommendation(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Adaptive recommendation error:", error);
    res.status(500).json({ success: false, error: "Failed to build your adaptive learning recommendation." });
  }
}

async function nextPack(req, res) {
  try {
    const recommendation = await buildAdaptiveRecommendation(req.user.id);
    const sourceSession = recommendation.sourceSession?.id
      ? await StudySession.findOne({ _id: recommendation.sourceSession.id, userId: req.user.id }).select("_id title documentName documentId studyText subject topic").lean()
      : null;

    if (!sourceSession?.studyText) {
      return res.status(409).json({
        success: false,
        code: "NO_ADAPTIVE_SOURCE",
        error: "I need a saved study pack or study session before I can build the next adaptive pack. Create one study pack first."
      });
    }

    const mastery = Number(recommendation.mastery || 0);
    const difficulty = mastery < 45 ? "easy" : mastery < 70 ? "medium" : "hard";
    const modeInstructions = {
      learn: "Prioritize clear concept teaching, examples and a small amount of recall practice.",
      practice: "Prioritize targeted MCQs, short-answer problems, common mistakes and explanation of why answers are correct.",
      revise: "Prioritize active recall, memory tricks, mistakes, concise cheat-sheet material and spaced-repetition friendly flashcards."
    };

    const orchestrator = global.smartStudyAI?.orchestrator;
    if (!orchestrator) return res.status(503).json({ success: false, error: "The adaptive AI engine is not available." });

    const result = await orchestrator.planAndExecute({
      goal: `Build the next adaptive study pack from the saved material. Focus strongly on ${recommendation.focusTopic}. Learning stage: ${recommendation.mode}. ${modeInstructions[recommendation.mode]}`,
      text: String(sourceSession.studyText).slice(0, 100000),
      title: `Adaptive Pack · ${recommendation.focusTopic}`,
      documentId: sourceSession.documentId || undefined,
      userId: req.user.id,
      sessionId: `adaptive-${String(sourceSession._id)}`,
      contextMode: "study",
      studyPreferences: {
        style: "adaptive",
        difficulty,
        focus: recommendation.focusTopic,
        adaptiveMode: recommendation.mode,
        adaptiveReason: recommendation.reason
      }
    });

    res.json({ success: true, data: result, recommendation, sourceText: String(sourceSession.studyText).slice(0, 100000), sourceSession: { id: sourceSession._id, title: sourceSession.title, documentId: sourceSession.documentId || null } });
  } catch (error) {
    console.error("Adaptive next-pack error:", error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || "Failed to generate the next adaptive study pack." });
  }
}

module.exports = { recommendation, nextPack };
