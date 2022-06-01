var express = require("express");
var router = express.Router();

var user_controller = require("../controllers/userController");
var game_controller = require("../controllers/gameController");

// POST register page
router.post("/signup", user_controller.signup_post);

// POST login page
router.post("/login", user_controller.login_post);

// GET user
router.get("/:user_id", user_controller.user_get);

// GET game list for user
router.get("/games/:user_id", user_controller.game_list_get);

// POST create game
router.post("/create_game", game_controller.game_create_post);

module.exports = router;
