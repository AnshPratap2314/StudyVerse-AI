const Topic = require("../models/Topic");
const QuizAttempt = require("../models/QuizAttempt");
const Flashcard = require("../models/Flashcard");
const StudySession = require("../models/StudySession");

function cardPerformance(card) {
  if (card.knowledgeStatus === "known") return 100;
  if (card.knowledgeStatus === "unknown") return card.reviewCount ? Math.min(55, Math.max(0, Number(card.lastReviewScore || 25))) : 0;
  if (!card.reviewCount) return 0;
  if (card.lastRating === "Easy") return 100;
  if (card.lastRating === "Good") return 80;
  if (card.lastRating === "Hard") return 55;
  if (card.lastRating === "Again") return 25;
  if (card.difficulty === "easy") return 100;
  if (card.difficulty === "hard") return 40;
  return 70;
}

async function refreshTopics(userId) {
  const [attempts, cards, sessions] = await Promise.all([
    QuizAttempt.find({ userId }).sort({ completedAt: -1 }).limit(500).lean(),
    Flashcard.find({ userId }).select("topic reviewCount lastRating difficulty nextReviewAt knowledgeStatus").lean(),
    StudySession.find({ userId }).select("subject topic studyDuration status completedAt").lean()
  ]);

  const stats = {};
  const ensure = (name, subject = "General") => {
    const key = `${subject}::${name}`;
    stats[key] ??= { name, subject, quizScores: [], cardScores: [], studyTime: 0, attempts: 0, lastStudiedAt: null };
    return stats[key];
  };

  for (const a of attempts) {
    for (const [topic, score] of Object.entries(a.topicPerformance || {})) {
      const s = ensure(topic);
      s.quizScores.push(Number(score));
      s.attempts += 1;
      s.lastStudiedAt = s.lastStudiedAt && new Date(s.lastStudiedAt) > new Date(a.completedAt || 0) ? s.lastStudiedAt : a.completedAt;
    }
  }

  for (const c of cards) {
    if (!c.topic) continue;
    const s = ensure(c.topic);
    if (c.reviewCount > 0) s.cardScores.push(cardPerformance(c));
  }

  for (const session of sessions) {
    if (!session.topic) continue;
    const s = ensure(session.topic, session.subject || "General");
    s.studyTime += Number(session.studyDuration || 0);
    const d = session.completedAt || null;
    if (d && (!s.lastStudiedAt || new Date(d) > new Date(s.lastStudiedAt))) s.lastStudiedAt = d;
  }

  const out = [];
  for (const s of Object.values(stats)) {
    const quiz = s.quizScores.length ? s.quizScores.reduce((a, b) => a + b, 0) / s.quizScores.length : 0;
    const flashcard = s.cardScores.length ? s.cardScores.reduce((a, b) => a + b, 0) / s.cardScores.length : 0;
    const performanceParts = [];
    if (s.quizScores.length) performanceParts.push(quiz);
    if (s.cardScores.length) performanceParts.push(flashcard);
    const mastery = performanceParts.length ? performanceParts.reduce((a, b) => a + b, 0) / performanceParts.length : 0;
    const weakness = Math.max(0, Math.min(100, 100 - mastery));
    const status = mastery === 0 ? "Unknown" : mastery <= 40 ? "Weak" : mastery <= 70 ? "Developing" : "Strong";

    const t = await Topic.findOneAndUpdate(
      { userId, name: s.name, subject: s.subject },
      {
        userId, name: s.name, subject: s.subject,
        quizPerformance: Math.round(quiz),
        flashcardPerformance: Math.round(flashcard),
        masteryScore: Math.round(mastery),
        weaknessScore: Math.round(weakness),
        status, attemptCount: s.attempts, studyTime: Math.round(s.studyTime),
        lastStudiedAt: s.lastStudiedAt || undefined
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    out.push(t);
  }
  return out;
}

async function getTopics(userId) {
  await refreshTopics(userId);
  return Topic.find({ userId }).sort({ weaknessScore: -1, name: 1 }).lean();
}

module.exports = { refreshTopics, getTopics };
