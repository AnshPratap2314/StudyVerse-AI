const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class MemoryStore {
  constructor(filePath, model = null, dbReady = () => false) { this.filePath = filePath; this.model = model; this.dbReady = dbReady; this.state = { conversations: [], memories: [], preferences: {} }; this.load(); }
  mongoEnabled() { return Boolean(this.model && this.dbReady()); }
  load() { try { if (fs.existsSync(this.filePath)) this.state = { ...this.state, ...JSON.parse(fs.readFileSync(this.filePath, "utf8")) }; } catch {} }
  save() { if (this.mongoEnabled()) return; fs.mkdirSync(path.dirname(this.filePath), { recursive: true }); const tmp = `${this.filePath}.tmp`; fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2)); fs.renameSync(tmp, this.filePath); }
  async addMessage({ userId = "anonymous", sessionId = "default", role, content, metadata = {} }) {
    const item = { id: crypto.randomUUID(), userId: String(userId), sessionId: String(sessionId), role, content: String(content || ""), metadata, createdAt: Date.now() };
    if (this.mongoEnabled()) { await this.model.create({ ...item, kind: "conversation", createdAt: new Date(item.createdAt) }); return item; }
    this.state.conversations.push(item); this.state.conversations = this.state.conversations.slice(-5000); this.save(); return item;
  }
  async history(userId = "anonymous", sessionId = "default", limit = 20) {
    const take = Math.max(1, Math.min(Number(limit) || 20, 100));
    if (this.mongoEnabled()) return this.model.find({ userId: String(userId), kind: "conversation", sessionId: String(sessionId) }).sort({ createdAt: -1 }).limit(take).lean().then(rows => rows.reverse().map(this.normalizeConversation));
    return this.state.conversations.filter(x => x.userId === userId && x.sessionId === sessionId).slice(-take);
  }
  normalizeConversation(x) { return { id: String(x._id || x.id), userId: x.userId, sessionId: x.sessionId, role: x.role, content: x.content, metadata: x.metadata || {}, createdAt: new Date(x.createdAt).getTime() }; }
  async addMemory({ userId = "anonymous", type, key, value, source = "user", confidence = 1 }) {
    const item = { id: crypto.randomUUID(), userId: String(userId), type, key, value, source, confidence, createdAt: Date.now(), updatedAt: Date.now() };
    if (this.mongoEnabled()) { const saved = await this.model.findOneAndUpdate({ userId: item.userId, kind: "memory", key: item.key }, { ...item, kind: "memory", updatedAt: new Date(item.updatedAt) }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(); return { ...item, id: String(saved._id || item.id) }; }
    const idx = this.state.memories.findIndex(x => x.userId === item.userId && x.key === key); if (idx >= 0) { item.id = this.state.memories[idx].id; this.state.memories[idx] = item; } else this.state.memories.push(item); this.save(); return item;
  }
  async getMemories(userId = "anonymous", limit = 50) {
    const take = Math.max(1, Math.min(Number(limit) || 50, 100));
    if (this.mongoEnabled()) return this.model.find({ userId: String(userId), kind: "memory" }).sort({ updatedAt: -1 }).limit(take).lean().then(rows => rows.map(x => ({ id: String(x._id), userId: x.userId, type: x.type, key: x.key, value: x.value, source: x.source, confidence: x.confidence, createdAt: new Date(x.createdAt).getTime(), updatedAt: new Date(x.updatedAt).getTime() })));
    return this.state.memories.filter(x => x.userId === userId).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, take);
  }
  async removeMemory(userId, id) {
    if (this.mongoEnabled()) { const result = await this.model.deleteOne({ _id: id, userId: String(userId), kind: "memory" }); return result.deletedCount === 1; }
    const before = this.state.memories.length; this.state.memories = this.state.memories.filter(x => !(x.userId === userId && x.id === id)); if (this.state.memories.length !== before) this.save(); return before !== this.state.memories.length;
  }
  async setPreference(userId, key, value) {
    if (this.mongoEnabled()) { await this.model.findOneAndUpdate({ userId: String(userId), kind: "preference", key }, { userId: String(userId), kind: "preference", key, value, updatedAt: new Date() }, { upsert: true, new: true }); return this.getPreferences(userId); }
    if (!this.state.preferences[userId]) this.state.preferences[userId] = {}; this.state.preferences[userId][key] = value; this.save(); return this.state.preferences[userId];
  }
  async getPreferences(userId) {
    if (this.mongoEnabled()) { const rows = await this.model.find({ userId: String(userId), kind: "preference" }).lean(); return Object.fromEntries(rows.map(x => [x.key, x.value])); }
    return this.state.preferences[userId] || {};
  }
  async context(userId, sessionId, limit = 10) { return { history: await this.history(userId, sessionId, limit), memories: await this.getMemories(userId, 20), preferences: await this.getPreferences(userId) }; }
  async counts(userId) {
    if (this.mongoEnabled()) { const [conversations, memories] = await Promise.all([this.model.countDocuments({ userId: String(userId), kind: "conversation" }), this.model.countDocuments({ userId: String(userId), kind: "memory" })]); return { conversations, memories }; }
    return { conversations: this.state.conversations.filter(x => String(x.userId) === String(userId)).length, memories: this.state.memories.filter(x => String(x.userId) === String(userId)).length };
  }
}
module.exports = { MemoryStore };
