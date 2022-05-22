var express = require("express");
var router = express.Router();

var user_controller = require("../controllers/userController");

// POST register page
router.post("/signup", user_controller.signup_post);

module.exports = router;
