// ============================================================
// AUTHENTICATION ROUTES
// ============================================================

const express = require("express");
const router = express.Router();

const { register, login, getMe, logout, forgotPassword, resetPassword } = require("../controllers/authController");
const authenticateToken = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.post("/logout", authenticateToken, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;