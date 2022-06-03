const { body, validationResult } = require("express-validator");
var User = require("../models/user");
var async = require("async");

// Check for logged in user
exports.login_get = async (req, res, next) => {
  if (req.session.user) {
    req.session.user.password = null;
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
};

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

// Handle user login post
exports.login_post = [
  // Validate and sanitize input
  body("email", "Email cannot be empty").trim().isLength({ min: 1 }).escape(),
  body("password", "Password cannot be empty")
    .trim()
    .isLength({ min: 1 })
    .escape(),
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
          console.log(req.session.user);
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
    .trim()
    .isStrongPassword()
    .escape(),
  body("password_conf").trim().escape(),
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
