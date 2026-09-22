// ============================================================
// STUDY SESSION CONTROLLER
// ============================================================

const StudySession = require("../models/StudySession");
const { requireValidId } = require("../utils/ownership");
const { refreshTopics } = require("../services/topicService");

// ------------------------------------------------------------
// CREATE SESSION
// ------------------------------------------------------------
async function createSession(req, res) {
    try {
        const {
            title,
            documentName,
            documentId,
            subject,
            topic,
            studyText,
            summary,
            keywords,
            flashcards,
            quiz,
            mindmap,
            memoryTricks,
            cheatSheet,
            formulas,
            commonMistakes,
            examTips,
            learningMethods,
            revisionPlan,
            practiceQuestions,
            examples,
            messages
        } = req.body;

        const newSession = await StudySession.create({
            userId: req.user.id, // Strictly populated from authenticated token
            title: title ? String(title).trim() : "Untitled Study Session",
            documentName: documentName ? String(documentName).trim() : "Study Notes",
            documentId,
            subject: subject ? String(subject).trim() : "General",
            topic: topic ? String(topic).trim() : "General",
            studyText: studyText || "",
            summary: summary || "",
            keywords: Array.isArray(keywords) ? keywords : [],
            flashcards: Array.isArray(flashcards) ? flashcards : [],
            quiz: Array.isArray(quiz) ? quiz : [],
            mindmap: mindmap || { mainTopic: "", subTopics: [] },
            memoryTricks: Array.isArray(memoryTricks) ? memoryTricks : [],
            cheatSheet: Array.isArray(cheatSheet) ? cheatSheet : [],
            formulas: Array.isArray(formulas) ? formulas : [],
            commonMistakes: Array.isArray(commonMistakes) ? commonMistakes : [],
            examTips: Array.isArray(examTips) ? examTips : [],
            learningMethods: Array.isArray(learningMethods) ? learningMethods : [],
            revisionPlan: Array.isArray(revisionPlan) ? revisionPlan : [],
            practiceQuestions: Array.isArray(practiceQuestions) ? practiceQuestions : [],
            examples: Array.isArray(examples) ? examples : [],
            messages: Array.isArray(messages) ? messages : [],
            lastActiveAt: new Date()
        });

        return res.status(201).json({
            success: true,
            message: "Study session saved successfully.",
            session: newSession
        });
    } catch (error) {
        console.error("❌ Create session error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to save study session."
        });
    }
}


// ------------------------------------------------------------
// GET ALL SESSIONS FOR AUTHENTICATED USER
// ------------------------------------------------------------
async function getSessions(req, res) {
    try {
        // Enforce user isolation: Query ONLY records belonging to req.user.id
        const sessions = await StudySession.find({ userId: req.user.id })
            .select("title documentName summary keywords status lastActiveAt createdAt updatedAt")
            .sort({ updatedAt: -1 });

        return res.status(200).json({
            success: true,
            count: sessions.length,
            sessions
        });
    } catch (error) {
        console.error("❌ Get sessions error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch study sessions."
        });
    }
}


// ------------------------------------------------------------
// GET SINGLE SESSION BY ID
// ------------------------------------------------------------
async function getSessionById(req, res) {
    try {
        requireValidId(req.params.id);
        // Enforce ownership: Check both _id AND userId
        const session = await StudySession.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: "Study session not found or unauthorized access."
            });
        }

        return res.status(200).json({
            success: true,
            session
        });
    } catch (error) {
        console.error("❌ Get session by ID error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch study session."
        });
    }
}


// ------------------------------------------------------------
// UPDATE SESSION
// ------------------------------------------------------------
async function updateSession(req, res) {
    try {
        requireValidId(req.params.id);
        const { title, messages, status, summary, keywords, flashcards, quiz, mindmap, memoryTricks, cheatSheet, formulas, commonMistakes, examTips, learningMethods, revisionPlan, practiceQuestions, examples, subject, topic, studyDuration } = req.body;

        const session = await StudySession.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: "Study session not found or unauthorized access."
            });
        }

        if (title !== undefined) session.title = String(title).trim();
        if (status !== undefined && ["active", "completed", "archived"].includes(status)) session.status = status;
        if (subject !== undefined) session.subject = String(subject).trim();
        if (topic !== undefined) session.topic = String(topic).trim();
        if (studyDuration !== undefined) { const duration = Number(studyDuration); if (!Number.isFinite(duration) || duration < 0) return res.status(400).json({success:false,error:"Study duration must be a non-negative number."}); session.studyDuration = duration; }
        if (summary !== undefined) session.summary = summary;
        if (Array.isArray(keywords)) session.keywords = keywords;
        if (Array.isArray(flashcards)) session.flashcards = flashcards;
        if (Array.isArray(quiz)) session.quiz = quiz;
        if (mindmap !== undefined) session.mindmap = mindmap;
        if (Array.isArray(memoryTricks)) session.memoryTricks = memoryTricks;
        if (Array.isArray(cheatSheet)) session.cheatSheet = cheatSheet;
        if (Array.isArray(formulas)) session.formulas = formulas;
        if (Array.isArray(commonMistakes)) session.commonMistakes = commonMistakes;
        if (Array.isArray(examTips)) session.examTips = examTips;
        if (Array.isArray(learningMethods)) session.learningMethods = learningMethods;
        if (Array.isArray(revisionPlan)) session.revisionPlan = revisionPlan;
        if (Array.isArray(practiceQuestions)) session.practiceQuestions = practiceQuestions;
        if (Array.isArray(examples)) session.examples = examples;

        if (Array.isArray(messages)) {
            session.messages = messages;
        }

        if (session.status === "completed" && !session.completedAt) session.completedAt = new Date();
        if (session.status !== "completed") session.completedAt = undefined;
        session.lastActiveAt = new Date();
        await session.save();
        if (session.status === "completed") await refreshTopics(req.user.id);

        return res.status(200).json({
            success: true,
            message: "Study session updated successfully.",
            session
        });
    } catch (error) {
        console.error("❌ Update session error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to update study session."
        });
    }
}


// ------------------------------------------------------------
// DELETE SESSION
// ------------------------------------------------------------
async function completeSession(req, res) {
    try {
        const session = await StudySession.findOne({ _id: req.params.id, userId: req.user.id });
        if (!session) return res.status(404).json({ success: false, error: "Study session not found or unauthorized access." });
        if (session.status === "completed") return res.json({ success: true, message: "Study session already completed.", session });

        let duration = req.body && req.body.studyDuration !== undefined ? Number(req.body.studyDuration) : Number(session.studyDuration || 0);
        if (!Number.isFinite(duration) || duration < 0) return res.status(400).json({ success: false, error: "Study duration must be a non-negative number." });
        if (duration === 0 && session.startedAt) duration = Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000));

        session.studyDuration = duration;
        session.status = "completed";
        session.completedAt = new Date();
        session.lastActiveAt = session.completedAt;
        await session.save();
        await refreshTopics(req.user.id);

        return res.status(200).json({ success: true, message: "Study session completed successfully.", session });
    } catch (error) {
        console.error("❌ Complete session error:", error);
        return res.status(500).json({ success: false, error: "Failed to complete study session." });
    }
}

async function deleteSession(req, res) {
    try {
        requireValidId(req.params.id);
        // Enforce ownership: Delete ONLY if _id and userId match
        const deletedSession = await StudySession.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!deletedSession) {
            return res.status(404).json({
                success: false,
                error: "Study session not found or unauthorized access."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Study session deleted successfully."
        });
    } catch (error) {
        console.error("❌ Delete session error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to delete study session."
        });
    }
}


module.exports = {
    createSession,
    getSessions,
    getSessionById,
    updateSession,
    deleteSession,
    completeSession
};