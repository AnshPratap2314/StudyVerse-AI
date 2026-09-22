const mongoose = require("mongoose");

const googleIntegrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  accessToken: { type: String, required: true, select: false },
  refreshToken: { type: String, select: false },
  expiresAt: { type: Date },
  scopes: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("GoogleIntegration", googleIntegrationSchema);
