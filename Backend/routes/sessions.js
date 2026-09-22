// ============================================================
// STUDY SESSION ROUTES
// ============================================================

const express = require("express");
const router = express.Router();

const {
    createSession,
    getSessions,
    getSessionById,
    updateSession,
    deleteSession,
    completeSession
} = require("../controllers/sessionController");

const authenticateToken = require("../middleware/auth");

// All session routes are protected
router.use(authenticateToken);

router.post("/", createSession);
router.get("/", getSessions);
router.get("/:id", getSessionById);
router.put("/:id", updateSession);
router.post("/:id/complete", completeSession);
router.delete("/:id", deleteSession);

module.exports = router;