// ============================================================
// STUDY SESSION MODEL
// ============================================================

const mongoose = require("mongoose");

const studySessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        title: {
            type: String,
            required: [true, "Session title is required"],
            trim: true,
            default: "Untitled Study Session"
        },

        documentName: {
            type: String,
            trim: true,
            default: "Study Notes"
        },
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", index: true },
        subject: { type: String, trim: true, default: "General" },
        topic: { type: String, trim: true, default: "General" },

        studyText: {
            type: String,
            default: ""
        },

        summary: {
            type: String,
            default: ""
        },

        keywords: [{ type: String }],

        flashcards: [
            {
                question: String,
                answer: String
            }
        ],

        quiz: [
            {
                question: String,
                options: [String],
                answer: String
            }
        ],

        mindmap: {
            mainTopic: { type: String, default: "" },
            subTopics: [{ type: String }]
        },
        memoryTricks: [{ type: String }],
        cheatSheet: [{ label: String, value: String }],
        formulas: [{ name: String, formula: String, note: String }],
        commonMistakes: [{ type: String }],
        examTips: [{ type: String }],
        learningMethods: [{ method: String, how: String, when: String }],
        revisionPlan: [{ day: String, focus: String, action: String }],
        practiceQuestions: [{ question: String, answer: String }],
        examples: [{ concept: String, example: String }],

        messages: [
            {
                role: {
                    type: String,
                    enum: ["user", "ai"],
                    required: true
                },
                text: {
                    type: String,
                    required: true
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        status: {
            type: String,
            enum: ["active", "completed", "archived"],
            default: "active"
        },
        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
        studyDuration: { type: Number, default: 0, min: 0 },

        lastActiveAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("StudySession", studySessionSchema);