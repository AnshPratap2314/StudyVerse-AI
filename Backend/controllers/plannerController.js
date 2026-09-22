const StudyPlan = require("../models/StudyPlan");
const { requireValidId } = require("../utils/ownership");

const ALLOWED_STATUS = ["active", "completed", "archived"];
const ALLOWED_PRIORITY = ["low", "medium", "high"];

function startOfDay(value = new Date()) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function cleanTopics(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(x => typeof x === "string").map(x => x.trim()).filter(Boolean))].slice(0, 100);
}

function buildItems({ topics, subject, dailyTarget, durationDays, startDate, priority }) {
  const count = Math.max(1, Math.min(Number(durationDays) || topics.length || 1, 365));
  const safeTopics = topics.length ? topics : ["General"];
  const items = [];
  const firstDate = startOfDay(startDate || new Date());

  for (let i = 0; i < count; i++) {
    const date = new Date(firstDate);
    date.setDate(firstDate.getDate() + i);
    const topic = safeTopics[i % safeTopics.length];
    items.push({
      title: `Study ${topic}`,
      subject: subject || "General",
      topic,
      date,
      duration: Number(dailyTarget) || 60,
      priority: priority || "medium",
      status: "pending"
    });
  }
  return items;
}

async function create(req, res) {
  try {
    const body = req.body || {};
    if (!body.title || !String(body.title).trim()) return res.status(400).json({ success: false, error: "Plan title is required." });

    const dailyTarget = Number(body.dailyMinutes ?? body.dailyTarget ?? 60);
    if (!Number.isFinite(dailyTarget) || dailyTarget < 0 || dailyTarget > 1440) return res.status(400).json({ success: false, error: "Daily target must be between 0 and 1440 minutes." });

    const topics = cleanTopics(body.topics);
    const durationDays = Math.max(1, Math.min(Number(body.durationDays) || Math.max(topics.length, 1), 365));
    const priority = ALLOWED_PRIORITY.includes(body.priority) ? body.priority : "medium";
    const startDate = body.startDate ? new Date(body.startDate) : startOfDay(new Date());
    if (Number.isNaN(startDate.getTime())) return res.status(400).json({ success: false, error: "Invalid start date." });

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays - 1);

    const p = await StudyPlan.create({
      userId: req.user.id,
      title: String(body.title).trim(),
      goal: body.goal ? String(body.goal).trim() : body.description ? String(body.description).trim() : "",
      subject: body.subject ? String(body.subject).trim() : "General",
      topic: body.topic ? String(body.topic).trim() : undefined,
      topics,
      durationDays,
      startDate,
      endDate,
      dailyTarget,
      priority,
      status: "active",
      items: buildItems({ topics, subject: body.subject, dailyTarget, durationDays, startDate, priority })
    });

    res.status(201).json({ success: true, data: p });
  } catch (e) {
    console.error("Create study plan error:", e);
    res.status(500).json({ success: false, error: "Failed to create study plan." });
  }
}

async function list(req, res) {
  try {
    const p = await StudyPlan.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, count: p.length, data: p });
  } catch (e) { res.status(500).json({ success: false, error: "Failed to fetch study plans." }); }
}

async function get(req, res) {
  try {
    requireValidId(req.params.id);
    const p = await StudyPlan.findOne({ _id: req.params.id, userId: req.user.id });
    if (!p) return res.status(404).json({ success: false, error: "Study plan not found." });
    res.json({ success: true, data: p });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, error: e.statusCode ? e.message : "Failed to fetch plan." }); }
}

async function update(req, res) {
  try {
    requireValidId(req.params.id);
    const p = await StudyPlan.findOne({ _id: req.params.id, userId: req.user.id });
    if (!p) return res.status(404).json({ success: false, error: "Study plan not found." });

    const body = req.body || {};
    if (body.title !== undefined) { if (typeof body.title !== "string" || !body.title.trim()) return res.status(400).json({ success: false, error: "Plan title cannot be empty." }); p.title = body.title.trim(); }
    if (body.goal !== undefined) p.goal = String(body.goal).trim();
    if (body.subject !== undefined) p.subject = String(body.subject).trim();
    if (body.topic !== undefined) p.topic = String(body.topic).trim();
    if (body.topics !== undefined) p.topics = cleanTopics(body.topics);
    if (body.startDate !== undefined) { const d = new Date(body.startDate); if (Number.isNaN(d.getTime())) return res.status(400).json({ success: false, error: "Invalid start date." }); p.startDate = d; }
    if (body.endDate !== undefined) { const d = new Date(body.endDate); if (Number.isNaN(d.getTime())) return res.status(400).json({ success: false, error: "Invalid end date." }); p.endDate = d; }
    if (body.dailyTarget !== undefined || body.dailyMinutes !== undefined) { const n = Number(body.dailyTarget ?? body.dailyMinutes); if (!Number.isFinite(n) || n < 0 || n > 1440) return res.status(400).json({ success: false, error: "Daily target must be between 0 and 1440 minutes." }); p.dailyTarget = n; }
    if (body.priority !== undefined) { if (!ALLOWED_PRIORITY.includes(body.priority)) return res.status(400).json({ success: false, error: "Invalid plan priority." }); p.priority = body.priority; }
    if (body.status !== undefined) { if (!ALLOWED_STATUS.includes(body.status)) return res.status(400).json({ success: false, error: "Invalid plan status." }); p.status = body.status; }
    if (Array.isArray(body.items)) p.items = body.items;

    await p.save();
    res.json({ success: true, data: p });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, error: e.statusCode ? e.message : "Failed to update plan." }); }
}

async function updateItem(req, res) {
  try {
    requireValidId(req.params.id);
    const p = await StudyPlan.findOne({ _id: req.params.id, userId: req.user.id });
    if (!p) return res.status(404).json({ success: false, error: "Study plan not found." });
    const item = p.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, error: "Plan item not found." });

    const body = req.body || {};
    if (body.title !== undefined) item.title = String(body.title).trim();
    if (body.subject !== undefined) item.subject = String(body.subject).trim();
    if (body.topic !== undefined) item.topic = String(body.topic).trim();
    if (body.date !== undefined) { const d = new Date(body.date); if (Number.isNaN(d.getTime())) return res.status(400).json({ success: false, error: "Invalid item date." }); item.date = d; }
    if (body.duration !== undefined) { const n = Number(body.duration); if (!Number.isFinite(n) || n < 0 || n > 1440) return res.status(400).json({ success: false, error: "Item duration must be between 0 and 1440 minutes." }); item.duration = n; }
    if (body.priority !== undefined) { if (!ALLOWED_PRIORITY.includes(body.priority)) return res.status(400).json({ success: false, error: "Invalid item priority." }); item.priority = body.priority; }
    if (body.status !== undefined) { if (!["pending", "completed", "skipped"].includes(body.status)) return res.status(400).json({ success: false, error: "Invalid item status." }); item.status = body.status; item.completedAt = body.status === "completed" ? (item.completedAt || new Date()) : undefined; }

    const allFinished = p.items.length > 0 && p.items.every(x => x.status === "completed" || x.status === "skipped");
    if (allFinished) p.status = "completed";
    else if (p.status === "completed" && body.status !== "completed") p.status = "active";

    await p.save();
    res.json({ success: true, data: p });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, error: e.statusCode ? e.message : "Failed to update plan item." }); }
}

async function completeItem(req, res) {
  req.body = { ...(req.body || {}), status: "completed" };
  return updateItem(req, res);
}

async function remove(req, res) {
  try {
    requireValidId(req.params.id);
    const p = await StudyPlan.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!p) return res.status(404).json({ success: false, error: "Study plan not found." });
    res.json({ success: true, message: "Study plan deleted." });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, error: e.statusCode ? e.message : "Failed to delete plan." }); }
}

module.exports = { create, list, get, update, updateItem, completeItem, remove };
