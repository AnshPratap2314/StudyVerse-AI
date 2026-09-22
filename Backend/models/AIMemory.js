const mongoose = require("mongoose");

const aiMemorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  kind: { type: String, enum: ["conversation", "memory", "preference"], required: true, index: true },
  sessionId: { type: String, default: "default", index: true },
  key: { type: String, default: null, index: true },
  role: { type: String, default: null },
  content: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  type: { type: String, default: null },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  source: { type: String, default: "user" },
  confidence: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

aiMemorySchema.index({ userId: 1, kind: 1, sessionId: 1, createdAt: -1 });
aiMemorySchema.index({ userId: 1, kind: 1, key: 1 }, { unique: true, partialFilterExpression: { kind: "memory" } });

module.exports = mongoose.model("AIMemory", aiMemorySchema);
