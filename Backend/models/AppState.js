const mongoose = require("mongoose");

const appStateSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model("AppState", appStateSchema);
