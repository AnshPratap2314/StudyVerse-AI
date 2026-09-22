const router = require("express").Router();
 const auth = require("../middleware/auth"); 
 const c = require("../controllers/progressController"); 
 router.use(auth); router.get("/", c.overview); 
 router.get("/:period", c.period);
  module.exports = router;
