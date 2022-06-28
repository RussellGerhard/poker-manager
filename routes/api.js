var express = require("express");
var router = express.Router();

var user_controller = require("../controllers/userController");
var game_controller = require("../controllers/gameController");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");

// THESE SHOULD ALL BE NOUNS, RESTful API maps URL to resource only (hence noun), HTTP request determines ACTION (verb)
// CREATE is POST
// READ is GET
// UPDATE is PUT/PATCH
// DELETE is DELETE

// So, it's really much more of a RPC API if we're being honest

// So much copy paste there has GOT to be a better way to use middleware
// for multiple routes, no time though

// POST contact form submit
router.post("/submit_contact_form", [
  // Validate and sanitize
  body("name", "Name must be between 1 and 40 characters")
    .trim()
    .isLength({ min: 1, max: 40 })
    .escape(),
  body("message", "Message must be between 1 and 140 characters")
    .trim()
    .isLength({ min: 1, max: 140 })
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // Send email
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        secure: true,
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_APP_KEY,
        },
      });

      transporter.sendMail({
        from: process.env.EMAIL,
        to: "russellgerhard1@gmail.com",
        subject: "Home Game Contact Form Submission",
        text: `${req.body.name} says: ${req.body.message}`,
      });
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
]);

// POST register
router.post("/signup", user_controller.signup_post);

// POST login
router.post("/login", user_controller.login_post);

// POST password reset email send
router.post("/send_password_link", user_controller.send_password_link_post);

// GET validate token in password email link
router.get(
  "/password_reset/:token",
  user_controller.validate_password_link_get
);

// GET venmo username of user
router.get(
  "/venmo_username",
  user_controller.user_session_exists,
  user_controller.venmo_username_get
);

// POST change email
router.post(
  "/change_email",
  user_controller.user_session_exists,
  user_controller.change_email_post
);

// POST change username
router.post(
  "/change_username",
  user_controller.user_session_exists,
  user_controller.change_username_post
);

// POST change password
router.post(
  "/change_password",
  user_controller.user_session_exists,
  user_controller.change_password_post
);

// POST delete account
router.post(
  "/delete_account",
  user_controller.user_session_exists,
  user_controller.delete_account_post
);

// POST password check
router.post(
  "/password_check",
  user_controller.user_session_exists,
  user_controller.password_check_post
);

// POST logout
router.post(
  "/logout",
  user_controller.user_session_exists,
  user_controller.logout_post
);

// GET logged in user (for AuthContext on reload)
router.get("/login", user_controller.login_get);

// GET notifications for user
router.get(
  "/notifications",
  user_controller.user_session_exists,
  user_controller.notifications_get
);

// POST delete notification
router.post(
  "/delete_notification",
  user_controller.user_session_exists,
  user_controller.delete_notification_post
);

// POST notifications clear
router.post(
  "/clear_notifications",
  user_controller.user_session_exists,
  user_controller.clear_notifications_post
);

// POST profit update
router.post(
  "/update_profit",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.update_profit_post
);

// GET game list for user
router.get(
  "/games",
  user_controller.user_session_exists,
  game_controller.game_list_get
);

// GET game details
router.get(
  "/games/:gameId",
  user_controller.user_session_exists,
  game_controller.is_member_params,
  game_controller.game_details_get
);

// GET game posts
router.get(
  "/posts/:gameId",
  user_controller.user_session_exists,
  game_controller.is_member_params,
  game_controller.game_posts_get
);

// POST message create
router.post(
  "/new_message",
  user_controller.user_session_exists,
  game_controller.is_member_post,
  game_controller.new_message_post
);

// POST message delete
router.post(
  "/delete_message",
  user_controller.user_session_exists,
  game_controller.delete_message_post
);

// POST add member
router.post(
  "/add_member",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.add_member_post
);

router.post(
  "/kick_member",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.kick_member_post
);

// POST join game
router.post(
  "/join_game",
  user_controller.user_session_exists,
  game_controller.join_game_post
);

// POST leave
router.post(
  "/leave_game",
  user_controller.user_session_exists,
  game_controller.is_member_post,
  game_controller.leave_game_post
);

// POST delete game
router.post(
  "/delete_game",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.delete_game_post
);

// POST create game
router.post(
  "/create_game",
  user_controller.user_session_exists,
  game_controller.game_form_post
);

// POST update game
router.post(
  "/edit_game",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.game_form_post
);

// POST create session
router.post(
  "/create_session",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.session_form_post
);

// POST update session
router.post(
  "/edit_session",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.session_exists,
  game_controller.session_form_post
);

router.post(
  "/join_session",
  user_controller.user_session_exists,
  game_controller.is_member_post,
  game_controller.session_exists,
  game_controller.join_session_post
);

router.post(
  "/leave_session",
  user_controller.user_session_exists,
  game_controller.is_member_post,
  game_controller.session_exists,
  game_controller.leave_session_post
);

router.post(
  "/delete_session",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.session_exists,
  game_controller.delete_session_post
);

router.post(
  "/submit_cashout",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.session_exists,
  game_controller.submit_cashout_post
);

router.post(
  "/remove_session_member",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.session_exists,
  game_controller.remove_session_member_post
);

router.post(
  "/send_rsvp_invite",
  user_controller.user_session_exists,
  game_controller.is_admin,
  game_controller.session_exists,
  game_controller.send_rsvp_invite_post
);

router.post(
  "/member_accept_rsvp",
  user_controller.user_session_exists,
  game_controller.is_member_post,
  game_controller.session_exists,
  game_controller.member_accept_rsvp_post
);

router.post(
  "/member_decline_rsvp",
  user_controller.user_session_exists,
  game_controller.is_member_post,
  game_controller.session_exists,
  game_controller.member_decline_rsvp_post
);

module.exports = router;
