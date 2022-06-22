const { body, validationResult } = require("express-validator");
const User = require("../models/user");
const Game = require("../models/game");
const Notification = require("../models/notification");
const Session = require("../models/session");
const Post = require("../models/post");
const Token = require("../models/token");
const async = require("async");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const he = require("he");
const sendEmail = require("../utils/sendEmail");

// Check for logged in user
exports.login_get = async (req, res, next) => {
  if (req.session.user) {
    req.session.user.password = null;
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
};

// Get user's venmo username
exports.venmo_username_get = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.json({ status: "ok", venmoUsername: user.venmoUsername });
  } catch (err) {
    return next(err);
  }
};

// Check if logged in user input correct password
exports.password_check_post = [
  body("password", "Password cannot be empty").isLength({ min: 1 }).escape(),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.session.user._id);

      user.comparePassword(req.body.password, (err, isMatch) => {
        if (err) {
          return next(err);
        }

        res.json({ status: "ok", isMatch: isMatch });
        return;
      });
    } catch (err) {
      return next(err);
    }
  },
];

// Handle user logout
exports.logout_post = async (req, res, next) => {
  try {
    req.session.destroy();
  } catch (err) {
    return next(err);
  }
  res.clearCookie(process.env.SESS_NAME);
  res.json({ status: "ok" });
};

// Handle email change
exports.change_email_post = [
  body("email", "Please enter a valid email")
    .trim()
    .isLength({ min: 1 })
    .isEmail()
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    try {
      await User.findByIdAndUpdate(req.session.user._id, {
        $set: {
          email: req.body.email,
        },
      });
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Handle username change
exports.change_username_post = [
  body(
    "username",
    "Username must be 3 to 20 letters, numbers, and/or underscores"
  )
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[A-Za-z0-9_]*$/)
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    try {
      // update user
      await User.findByIdAndUpdate(req.session.user._id, {
        $set: {
          username: req.body.username,
        },
      });

      // Update session username
      req.session.user.username = req.body.username;

      // Yield session user in result so context can be set
      res.json({ status: "ok", user: req.session.user });
    } catch (err) {
      return next(err);
    }
  },
];

// Handle password change
exports.change_password_post = [
  body(
    "password",
    "Password must be 8 to 20 characters with one uppercase and one lowercase letter, one number, and one symbol"
  )
    .isLength({ min: 1 })
    .isStrongPassword()
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // If session then changing password
    // Else we're resetting password from email link
    var userId;
    if (req.session?.user) {
      userId = req.session.user._id;
    } else {
      const token = await Token.findOne({ token: req.body.token });
      if (!token) {
        res.json({
          status: "error",
          errors: [{ param: "tokenErro", msg: "The URL token is invalid" }],
        });
      }
      userId = token.user;
    }
    try {
      // hash password
      var hash = await bcrypt.hash(
        req.body.password,
        parseInt(process.env.SALT_WORK_FACTOR)
      );

      // update user
      await User.findByIdAndUpdate(userId, {
        $set: {
          password: hash,
        },
      });

      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Delete account
exports.delete_account_post = async (req, res, next) => {
  try {
    // Delete and leave games (based on if user was admin)
    const user = await User.findByIdAndDelete(req.session.user._id);

    // Delete notifications
    await Notification.deleteMany({ recipient: user._id });

    // Delete or leave user's games
    for (gameId of user.games) {
      const game = await Game.findById(gameId);
      // If user is admin, delete game
      if (game.admin.equals(req.session.user._id)) {
        // Delete the game
        await Game.findByIdAndDelete(gameId);

        // Delete game session if exists
        await Session.findOneAndDelete({ game: gameId });

        // Delete any messages in game
        await Post.deleteMany({ game: gameId });

        // Delete any notifications having to do with this game
        await Notification.deleteMany({ game: gameId });

        // Delete game from all members' lists and notify them (except admin)
        for (member of game.members) {
          await User.findByIdAndUpdate(member, { $pull: { games: gameId } });

          if (!game.admin.equals(member)) {
            const notification = new Notification({
              sender: req.session.user._id,
              recipient: member,
              game: gameId,
              label: "Game Deleted",
              message: `${
                req.session.user.username
              } deleted their account, so their poker game, ${he.decode(
                game.name
              )}, no longer exists`,
              date: Date.now(),
            });
            await notification.save();
          }
        }
      } else {
        // Remove user from game members and profit tracking
        await Game.findByIdAndUpdate(gameId, {
          $pull: {
            members: req.session.user._id,
          },
          $unset: {
            [`member_profit_map.${req.session.user._id}`]: "",
          },
        });

        // Remove user from session
        await Session.findByIdAndUpdate(game.session, {
          $unset: {
            [`rsvp_map.${req.session.user._id}`]: "",
          },
        });

        // Delete posts by user
        await Post.deleteMany({ author: req.session.user._id });

        // Notify admin
        const notification = new Notification({
          sender: req.session.user._id,
          recipient: game.admin,
          game: gameId,
          label: "Game Notice",
          message: `${
            req.session.user.username
          } deleted their account, so they are no longer in your poker game, ${he.decode(
            game.name
          )}, and all of their posts have been deleted`,
          date: Date.now(),
        });

        await notification.save();
      }
    }

    // Destroy session and delete user
    await req.session.destroy();

    // Delete session cookie
    res.clearCookie(process.env.SESS_NAME);
    res.json({ status: "ok" });
  } catch (err) {
    return next(err);
  }
};

// Get notifications
exports.notifications_get = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      recipient: req.session.user._id,
    }).sort({ date: "desc" });
    res.json({ status: "ok", notifications: notifications });
  } catch (err) {
    return next(err);
  }
};

// Delete one notification
exports.delete_notification_post = [
  body("notificationId").escape(),
  async (req, res, next) => {
    try {
      await Notification.findByIdAndDelete(req.body.notificationId);
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Clear notifications
exports.clear_notifications_post = async (req, res, next) => {
  try {
    await Notification.deleteMany({ recipient: req.session.user._id });
    res.json({ status: "ok" });
  } catch (err) {
    return next(err);
  }
};

// Handle user login post
exports.login_post = [
  // Validate and sanitize input
  body("email", "Email cannot be empty").trim().isLength({ min: 1 }).escape(),
  body("password", "Password cannot be empty").isLength({ min: 1 }).escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);
    // Check for validation errors
    // Return these before performing expensive DB lookups
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // Check if user can authenticate
    User.getAuthenticated(
      req.body.email,
      req.body.password,
      (err, user, reason) => {
        // Handle serious authentication error
        if (err) {
          return next(err);
        }

        // Check for user
        if (user) {
          user.password = null;
          req.session.user = user;
          res.json({ status: "ok", user: user });
          return;
        }

        // Check for auth failure reason
        // Create error is there is a reason
        var reasons = User.failedLogin;
        var error = {};
        switch (reason) {
          case reasons.NOT_FOUND:
            error.msg = "Sorry, we couldn't find an account with that email";
            error.param = "email";
            break;
          case reasons.PASSWORD_INCORRECT:
            error.msg = "Sorry, that password is incorrect";
            error.param = "password";
            break;
          case reasons.MAX_ATTEMPTS:
            const LOCK_TIME_MINUTES = parseInt(process.env.LOCK_TIME) / 60000;
            const plural = LOCK_TIME_MINUTES > 1 ? true : false;
            error.msg = `Sorry, maximum login attempts reached, try again in ${LOCK_TIME_MINUTES} minute${
              plural ? "s" : ""
            }`;
            error.param = "";
            break;
        }
        error.value = "";
        error.location = "body";
        validation_errors.errors.push(error);
        res.json({ status: "error", errors: validation_errors.errors });
        return;
      }
    );
  },
];

// Handle user signup post
exports.signup_post = [
  // Validate and sanitize input
  // Only one message per input field so that param can be React unique key
  body(
    "username",
    "Username must be 3 to 20 letters, numbers, and/or underscores"
  )
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[A-Za-z0-9_]*$/)
    .escape(),
  body("email", "Please enter a valid email").trim().isEmail().escape(),
  body(
    "password",
    "Password must be 8 to 20 characters with one uppercase and one lowercase letter, one number, and one symbol"
  )
    .isStrongPassword()
    .escape(),
  body("password_conf").escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);

    // Perform validation on matching password fields
    if (req.body.password != req.body.password_conf) {
      validation_errors.errors.push({
        value: req.body.password_conf,
        msg: "Password does not match confirmation",
        param: "password_conf",
        location: "body",
      });
    }

    // Check for validation errors
    // Return these before performing expensive DB lookups
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // Check if email or username already exists
    async.parallel(
      {
        email_user: function (callback) {
          User.findOne({ email: req.body.email }).exec(callback);
        },
        username_user: function (callback) {
          User.findOne({ username: req.body.username }).exec(callback);
        },
      },
      (err, results) => {
        if (err) {
          return next(err);
        }

        // Add error message if email already in use
        if (results.email_user) {
          validation_errors.errors.push({
            value: "",
            msg: "An account with this email already exists",
            param: "email-conflict",
            location: "body",
          });
        }

        // Add error message if username already in use
        if (results.username_user) {
          validation_errors.errors.push({
            value: "",
            msg: "An account with this username already exists",
            param: "username-conflict",
            location: "body",
          });
        }

        // Send back errors
        if (results.email_user || results.username_user) {
          res.json({ status: "error", errors: validation_errors.errors });
          return;
        }

        // No errors so create and save new user!
        var user = new User({
          username: req.body.username,
          email: req.body.email,
          password: req.body.password,
        });

        user.save((err) => {
          if (err) {
            return next(err);
          }
          res.json({ status: "ok" });
          return;
        });
      }
    );
  },
];

// Send password reset link
exports.send_password_link_post = [
  body("email").escape(),
  async (req, res, next) => {
    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoUser",
              msg: "The email provided is not associated with an account",
            },
          ],
        });
        return;
      }

      // Check if user already has a token
      var token = await Token.findOne({ user: user._id });
      if (!token) {
        var token = new Token({
          user: user._id,
          token: crypto.randomBytes(32).toString("hex"),
        });
        await token.save();
      }

      // Generate link for email
      const link = `http://localhost:3001/api/password_reset/${token.token}`;
      await sendEmail({
        username: user.username,
        recipient: user.email,
        subject: "HomeGame: Password Reset",
        link: link,
      });

      res.json({ status: "ok" });
    } catch (err) {
      res.json({
        status: "error",
        errors: [{ param: "emailError", msg: err.message }],
      });
      return;
    }
  },
];

// Validate link for password reset
exports.validate_password_link_get = async (req, res, next) => {
  const token = await Token.findOne({ token: req.params.token });
  if (!token) {
    res.send("Sorry, that link is expired!");
    return;
  } else {
    res.redirect(301, `http://localhost:3000/password_reset/${token.token}`);
  }
};

// Check that user session exists, if not, send back error
exports.user_session_exists = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      res.json({
        status: "error",
        errors: [
          {
            param: "NoUserSession",
            msg: "Your session has expired",
          },
        ],
      });
    } else {
      next();
    }
  } catch (err) {
    return next(err);
  }
};
