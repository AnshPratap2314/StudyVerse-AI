const router = require("express").Router();
const auth = require("../middleware/auth");
const controller = require("../controllers/adaptiveController");

router.use(auth);
router.get("/next", controller.recommendation);
router.post("/next-pack", controller.nextPack);

module.exports = router;
