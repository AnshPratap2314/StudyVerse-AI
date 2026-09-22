const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  subject: { type: String, trim: true, default: "General" },
  topic: { type: String, trim: true, default: "General" },
  date: Date,
  duration: { type: Number, min: 0, default: 30 },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  status: { type: String, enum: ["pending", "completed", "skipped"], default: "pending" },
  completedAt: Date
}, { timestamps: true });

const planSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  goal: { type: String, trim: true, maxlength: 1000 },
  subject: { type: String, trim: true, default: "General" },
  topic: { type: String, trim: true },
  topics: { type: [String], default: [] },
  durationDays: { type: Number, min: 1, max: 365 },
  startDate: Date,
  endDate: Date,
  dailyTarget: { type: Number, min: 0, max: 1440, default: 60 },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  status: { type: String, enum: ["active", "completed", "archived"], default: "active" },
  items: { type: [itemSchema], default: [] }
}, { timestamps: true });

planSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("StudyPlan", planSchema);
