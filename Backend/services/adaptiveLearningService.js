const Flashcard = require("../models/Flashcard");
const QuizAttempt = require("../models/QuizAttempt");
const StudySession = require("../models/StudySession");
const { getTopics } = require("./topicService");

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function daysSince(date) {
  if (!date) return 30;
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 86400000);
}

async function buildAdaptiveRecommendation(userId) {
  const [topics, dueCards, recentAttempts, latestSession, allCards] = await Promise.all([
    getTopics(userId),
    Flashcard.find({ userId, status: "active", nextReviewAt: { $lte: new Date() } }).select("topic knowledgeStatus lastRating").lean(),
    QuizAttempt.find({ userId }).sort({ completedAt: -1 }).limit(30).select("topicPerformance percentage completedAt quizId").lean(),
    StudySession.findOne({ userId, studyText: { $exists: true, $ne: "" } }).sort({ updatedAt: -1 }).select("_id title documentName documentId subject topic studyText updatedAt").lean(),
    Flashcard.find({ userId, status: "active" }).select("knowledgeStatus reviewCount lastRating topic").lean()
  ]);

  const topicMap = new Map();
  for (const topic of topics) topicMap.set(`${topic.subject || "General"}::${topic.name}`, topic);

  const dueByTopic = new Map();
  for (const card of dueCards) {
    const key = String(card.topic || "General").trim() || "General";
    dueByTopic.set(key, (dueByTopic.get(key) || 0) + 1);
  }

  const quizByTopic = new Map();
  for (const attempt of recentAttempts) {
    for (const [name, score] of Object.entries(attempt.topicPerformance || {})) {
      const key = String(name || "General").trim() || "General";
      if (!quizByTopic.has(key)) quizByTopic.set(key, []);
      quizByTopic.get(key).push(Number(score));
    }
  }

  const candidates = topics.map((topic) => {
    const name = String(topic.name || "General").trim() || "General";
    const due = dueByTopic.get(name) || 0;
    const quizScores = quizByTopic.get(name) || [];
    const recentQuiz = average(quizScores);
    const mastery = clamp(topic.masteryScore);
    const weakness = clamp(100 - mastery);
    const quizWeakness = recentQuiz === null ? 25 : clamp(100 - recentQuiz);
    const duePressure = clamp(due * 18, 0, 100);
    const stalePressure = clamp(daysSince(topic.lastStudiedAt) * 8, 0, 100);
    const priority = Math.round(weakness * 0.5 + quizWeakness * 0.25 + duePressure * 0.15 + stalePressure * 0.1);
    return { name, subject: topic.subject || "General", mastery, status: topic.status, dueCards: due, recentQuizScore: recentQuiz === null ? null : Math.round(recentQuiz), weaknessScore: Math.round(weakness), priority, lastStudiedAt: topic.lastStudiedAt || null };
  });

  for (const [name, due] of dueByTopic.entries()) {
    if (candidates.some(x => x.name === name)) continue;
    candidates.push({ name, subject: "General", mastery: 0, status: "Unknown", dueCards: due, recentQuizScore: null, weaknessScore: 100, priority: Math.round(60 + Math.min(30, due * 4)), lastStudiedAt: null });
  }

  candidates.sort((a, b) => b.priority - a.priority || b.dueCards - a.dueCards || a.name.localeCompare(b.name));
  const focus = candidates[0] || { name: latestSession?.topic || "General", subject: latestSession?.subject || "General", mastery: 0, status: "Unknown", dueCards: 0, recentQuizScore: null, weaknessScore: 100, priority: 50, lastStudiedAt: null };

  const totalCards = allCards.length;
  const knownCards = allCards.filter(card => card.knowledgeStatus === "known").length;
  const reviewedCards = allCards.filter(card => Number(card.reviewCount || 0) > 0).length;
  const dueCount = dueCards.length;
  const quizScores = recentAttempts.map(x => Number(x.percentage)).filter(Number.isFinite);
  const overallQuiz = average(quizScores);

  let mode = "learn";
  let reason = `Build understanding of ${focus.name}.`;
  if (focus.dueCards > 0 || focus.mastery < 50) {
    mode = "revise";
    reason = focus.dueCards > 0
      ? `${focus.dueCards} review card${focus.dueCards === 1 ? " is" : "s are"} due for ${focus.name}.`
      : `${focus.name} is currently at ${focus.mastery}% mastery, so active recall comes first.`;
  } else if (focus.recentQuizScore !== null && focus.recentQuizScore < 70) {
    mode = "practice";
    reason = `Your recent ${focus.name} quiz performance is ${focus.recentQuizScore}%, so targeted practice is next.`;
  } else if (focus.lastStudiedAt && daysSince(focus.lastStudiedAt) >= 4) {
    mode = "revise";
    reason = `${focus.name} has not been revisited recently, so a spaced review is due.`;
  } else if (focus.mastery >= 80) {
    mode = "learn";
    reason = `${focus.name} is strong enough to move forward with the next concept.`;
  }

  const actionByMode = {
    learn: "Learn → understand the next concept → make recall cards",
    practice: "Practice → solve targeted questions → review mistakes",
    revise: "Revise → active recall → spaced repetition → fix weak points"
  };

  return {
    mode,
    focusTopic: focus.name,
    subject: focus.subject,
    mastery: focus.mastery,
    priority: focus.priority,
    reason,
    nextAction: actionByMode[mode],
    canGenerateNextPack: Boolean(latestSession?.studyText),
    sourceSession: latestSession ? { id: latestSession._id, title: latestSession.title, documentName: latestSession.documentName, documentId: latestSession.documentId || null } : null,
    learningData: {
      topicsTracked: topics.length,
      weakTopics: topics.filter(x => x.status === "Weak").length,
      dueFlashcards: dueCount,
      totalFlashcards: totalCards,
      knownFlashcards: knownCards,
      reviewedFlashcards: reviewedCards,
      quizAttempts: recentAttempts.length,
      recentQuizAverage: overallQuiz === null ? null : Math.round(overallQuiz)
    },
    candidates: candidates.slice(0, 6)
  };
}

module.exports = { buildAdaptiveRecommendation };
