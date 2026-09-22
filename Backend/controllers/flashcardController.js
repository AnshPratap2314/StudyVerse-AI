const Flashcard = require("../models/Flashcard");
const { calculateReview } = require("../utils/spacedRepetition");
const { requireValidId } = require("../utils/ownership");
const { refreshTopics } = require("../services/topicService");

async function create(req, res) {
  try {
    const { question, answer, topic, sessionId, documentId, difficulty } = req.body || {};
    if (!question || !answer) return res.status(400).json({ success: false, error: "Question and answer are required." });
    const f = await Flashcard.create({ userId: req.user.id, question: String(question).trim(), answer: String(answer).trim(), topic, sessionId, documentId, difficulty });
    res.status(201).json({ success: true, data: f });
  } catch (e) { res.status(500).json({ success: false, error: "Failed to create flashcard." }); }
}

async function list(req, res) { try { const f = await Flashcard.find({ userId: req.user.id, status: "active" }).sort({ nextReviewAt: 1, createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 200)); res.json({ success: true, count: f.length, data: f }); } catch (e) { res.status(500).json({ success: false, error: "Failed to fetch flashcards." }); } }

async function get(req, res) { try { requireValidId(req.params.id); const f = await Flashcard.findOne({ _id: req.params.id, userId: req.user.id }); if (!f) return res.status(404).json({ success: false, error: "Flashcard not found." }); res.json({ success: true, data: f }); } catch (e) { res.status(e.statusCode || 500).json({ success: false, error: e.statusCode ? e.message : "Failed to fetch flashcard." }); } }

async function due(req, res) { try { const f = await Flashcard.find({ userId: req.user.id, status: "active", nextReviewAt: { $lte: new Date() } }).sort({ nextReviewAt: 1 }).limit(100); res.json({ success: true, count: f.length, data: f }); } catch (e) { res.status(500).json({ success: false, error: "Failed to fetch due flashcards." }); } }

async function update(req, res) {
  try {
    requireValidId(req.params.id);
    const f = await Flashcard.findOne({ _id: req.params.id, userId: req.user.id });
    if (!f) return res.status(404).json({ success: false, error: "Flashcard not found." });
    for (const key of ["question", "answer", "topic", "difficulty", "status"]) if (req.body[key] !== undefined) f[key] = req.body[key];
    if (req.body.knowledgeStatus !== undefined) {
      const value = String(req.body.knowledgeStatus).toLowerCase();
      if (!["known", "unknown"].includes(value)) return res.status(400).json({ success: false, error: "knowledgeStatus must be known or unknown." });
      f.knowledgeStatus = value;
      f.lastKnowledgeAt = new Date();
    }
    await f.save();
    if (req.body.knowledgeStatus !== undefined) await refreshTopics(req.user.id);
    res.json({ success: true, data: f });
  } catch (e) { res.status(e.statusCode || 400).json({ success: false, error: e.statusCode ? e.message : "Failed to update flashcard." }); }
}

async function setKnowledge(req, res) {
  try {
    requireValidId(req.params.id);
    const value = String(req.body?.knowledgeStatus || (req.body?.known === true ? "known" : req.body?.known === false ? "unknown" : "")).toLowerCase();
    if (!["known", "unknown"].includes(value)) return res.status(400).json({ success: false, error: "knowledgeStatus must be known or unknown." });
    const f = await Flashcard.findOne({ _id: req.params.id, userId: req.user.id });
    if (!f) return res.status(404).json({ success: false, error: "Flashcard not found." });
    f.knowledgeStatus = value;
    f.lastKnowledgeAt = new Date();
    await f.save();
    await refreshTopics(req.user.id);
    res.json({ success: true, data: f });
  } catch (e) { res.status(e.statusCode || 400).json({ success: false, error: e.statusCode ? e.message : "Failed to update knowledge state." }); }
}

async function remove(req, res) { try { requireValidId(req.params.id); const f = await Flashcard.findOneAndDelete({ _id: req.params.id, userId: req.user.id }); if (!f) return res.status(404).json({ success: false, error: "Flashcard not found." }); res.json({ success: true, message: "Flashcard deleted." }); } catch (e) { res.status(e.statusCode || 500).json({ success: false, error: e.statusCode ? e.message : "Failed to delete flashcard." }); } }

async function review(req, res) { try { requireValidId(req.params.id); const f = await Flashcard.findOne({ _id: req.params.id, userId: req.user.id }); if (!f) return res.status(404).json({ success: false, error: "Flashcard not found." }); Object.assign(f, calculateReview(f, req.body.rating)); f.knowledgeStatus = ["good", "easy"].includes(String(req.body.rating || "").toLowerCase()) ? "known" : "unknown"; f.lastKnowledgeAt = new Date(); await f.save(); await refreshTopics(req.user.id); res.json({ success: true, data: f }); } catch (e) { res.status(e.statusCode || 400).json({ success: false, error: e.message || "Failed to review flashcard." }); } }

module.exports = { create, list, get, due, update, remove, review, setKnowledge };
