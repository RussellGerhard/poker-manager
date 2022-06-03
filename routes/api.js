var express = require("express");
var router = express.Router();

var user_controller = require("../controllers/userController");
var game_controller = require("../controllers/gameController");

// POST register
router.post("/signup", user_controller.signup_post);

// POST login
router.post("/login", user_controller.login_post);

// POST logout
router.post("/logout", user_controller.logout_post);

// GET logged in user
router.get("/login", user_controller.login_get);

// GET game list for user
router.get("/games/:user_id", game_controller.game_list_get);

// POST create game
router.post("/create_game", game_controller.game_create_post);

module.exports = router;
