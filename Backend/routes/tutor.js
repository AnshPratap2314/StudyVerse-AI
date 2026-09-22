const router = require("express").Router();
const auth = require("../middleware/auth");
const { chat } = require("../controllers/tutorController");
router.use(auth);
router.post("/chat", chat);
module.exports = router;
