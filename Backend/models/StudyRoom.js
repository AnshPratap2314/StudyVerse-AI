const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({ id: String, name: String }, { _id: false });
const messageSchema = new mongoose.Schema({ id: String, name: String, text: String, at: String }, { _id: false });
const documentSchema = new mongoose.Schema({ documentId: String, title: String, addedBy: String, addedAt: String }, { _id: false });
const quizSchema = new mongoose.Schema({ id: String, topic: String, createdBy: String, createdAt: String, questions: mongoose.Schema.Types.Mixed }, { _id: false });

const studyRoomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  allowedUsers: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
  messages: { type: [messageSchema], default: [] },
  notes: { type: String, default: "" },
  documents: { type: [documentSchema], default: [] },
  quizzes: { type: [quizSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model("StudyRoom", studyRoomSchema);
