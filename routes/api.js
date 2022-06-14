var express = require("express");
var router = express.Router();

var user_controller = require("../controllers/userController");
var game_controller = require("../controllers/gameController");

// POST register
router.post("/signup", user_controller.signup_post);

// POST change email
router.post("/change_email", user_controller.change_email_post);

// POST change username
router.post("/change_username", user_controller.change_username_post);

// POST change password
router.post("/change_password", user_controller.change_password_post);

// POST delete account
router.post("/delete_account", user_controller.delete_account_post);

// POST login
router.post("/login", user_controller.login_post);

// POST password check
router.post("/password_check", user_controller.password_check_post);

// POST logout
router.post("/logout", user_controller.logout_post);

// GET logged in user (for AuthContext on reload)
router.get("/login", user_controller.login_get);

// GET notifications for user
router.get("/notifications", user_controller.notifications_get);

// POST notifications clear
router.post("/clear_notifications", user_controller.clear_notifications_post);

// TODO VERIFY ADMIN
// POST profit update
router.post("/update_profit", game_controller.update_profit_post);

// GET game list for user
router.get("/games", game_controller.game_list_get);

// TODO VERIFY MEMBERSHIP
// GET game details
router.get("/games/:gameId", game_controller.game_details_get);

// TODO VERIFY MEMBERSHIP
// GET game posts
router.get("/posts/:gameId", game_controller.game_posts_get);

// TODO VERIFY MEMBERSHIP
// POST message create
router.post("/new_message", game_controller.new_message_post);

// POST message delete
router.post("/delete_message", game_controller.delete_message_post);

// TODO VERIFY ADMIN
// POST add member
router.post("/add_member", game_controller.add_member_post);

// TODO VERIFY ADMIN
router.post("/kick_member", game_controller.kick_member_post);

// POST join game
router.post("/join_game", game_controller.join_game_post);

// TODO VERIFY MEMBERSHIP
// POST leave
router.post("/leave_game", game_controller.leave_game_post);

// TODO VERIFY ADMIN
// POST delete game
router.post("/delete_game", game_controller.delete_game_post);

// POST create game
router.post("/create_game", game_controller.game_form_post);

// TODO VERIFY ADMIN
// POST update game
router.post("/edit_game", game_controller.game_form_post);

// TODO VERIFY ADMIN
// POST create session
router.post("/create_session", game_controller.session_form_post);

// TODO VERIFY ADMIN
// POST update session
router.post("/edit_session", game_controller.session_form_post);

module.exports = router;
