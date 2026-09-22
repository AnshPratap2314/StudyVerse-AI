const { buildLearningContext } = require("../services/learningContextService");
const { runSharedAI } = require("../services/aiBridge");
const Chat = require("../models/Chat");

async function chat(req, res) {
    try {
        const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
        const allowedModes = ["beginner", "normal", "socratic", "exam", "interview", "revision"];
        const mode = allowedModes.includes(String(req.body.mode || "normal").toLowerCase()) ? String(req.body.mode || "normal").toLowerCase() : "normal";
        if (!message) return res.status(400).json({ success: false, error: "Message is required." });
        if (message.length > 10000) return res.status(400).json({ success: false, error: "Message is too long." });

        const context = await buildLearningContext(req.user.id, {
            sessionId: req.body.sessionId,
            subject: req.body.subject,
            topic: req.body.topic
        });
        if (!context) return res.status(404).json({ success: false, error: "User not found." });

        const languageInstruction = `Respond in ${context.user.preferredLanguage || "English"} unless the student asks otherwise.`;
        const modeInstruction = { beginner: "Use very simple language and step-by-step examples.", normal: "Teach clearly at an appropriate student level.", socratic: "Ask guiding questions before revealing the answer.", exam: "Focus on exam-ready definitions, traps, formulas and concise answers.", interview: "Teach like an interview coach with likely follow-ups and evaluation tips.", revision: "Prioritize rapid recall, key points and active-recall prompts." }[mode];
        const result = await runSharedAI({ task: "tutor", userId: req.user.id, message: `${languageInstruction}\n${modeInstruction}\n\n${message}`, context, mode });
        const reply = typeof result === "string" ? result : result?.reply || result?.text || result?.content;
        if (!reply) return res.status(502).json({ success: false, error: "AI returned an empty tutor response." });

        let chat = null;
        if (req.body.chatId) {
            chat = await Chat.findOne({ _id: req.body.chatId, userId: req.user.id });
        }
        if (!chat) chat = await Chat.create({ userId: req.user.id, sessionId: req.body.sessionId, title: message.slice(0, 60), messages: [] });
        chat.messages.push({ role: "user", text: message });
        chat.messages.push({ role: "ai", text: String(reply) });
        await chat.save();

        res.json({ success: true, reply: String(reply), mode, chatId: chat._id, context: { topic: context.current.topic, weakTopics: context.weakTopics.map(t => t.name) } });
    } catch (e) {
        res.status(e.statusCode || 500).json({ success: false, error: e.statusCode ? e.message : "Tutor request failed." });
    }
}

module.exports = { chat };
