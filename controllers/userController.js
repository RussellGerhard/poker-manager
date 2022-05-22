const { body, validationResult } = require("express-validator");
var User = require("../models/user");
var async = require("async");

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
