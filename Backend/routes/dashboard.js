const router=require("express").Router();const auth=require("../middleware/auth");router.use(auth);router.get("/",require("../controllers/dashboardController").dashboard);module.exports=router;
