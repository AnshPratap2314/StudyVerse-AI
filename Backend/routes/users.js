// ============================================================
// USER ROUTES
// ============================================================

const express = require("express");
const router = express.Router();

const { getProfile, updateProfile } = require("../controllers/userController");
const authenticateToken = require("../middleware/auth");

router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

module.exports = router;