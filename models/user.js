var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var bcrypt = require("bcrypt");

var UserSchema = new Schema({
  // Basic user info
  username: { type: String, required: true, maxLength: 25 },
  email: {
    type: String,
    required: true,
    maxLength: 25,
    index: { unique: true },
  },
  verified: {
    type: Boolean,
    required: true,
    default: false,
  },
  password: { type: String, required: true, maxLength: 25 },
  // Login attempt counter
  loginAttempts: { type: Number, required: true, default: 0 },
  lockUntil: { type: Number },
  // Past poker sessions info
  games: [{ type: Schema.Types.ObjectId, ref: "Game" }],
  old_sessions: [{ type: Schema.Types.ObjectId, ref: "Session" }],
  profit: { type: Number, default: 0 },
  // Notifications
  notifications: [{ type: Schema.Types.ObjectId, ref: "Notification" }],
});

// Check if user is locked out
UserSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// Mongoose hash password before save (does not fire on update)
UserSchema.pre("save", async function (next) {
  var user = this;
  if (!user.isModified("password")) {
    return next();
  }

  try {
    // Hash password with salt generated from S_W_F rounds
    var hash = await bcrypt.hash(
      user.password,
      parseInt(process.env.SALT_WORK_FACTOR)
    );
    user.password = hash;
    return next();
  } catch (err) {
    return next(err);
  }
});

// Verify password
UserSchema.methods.comparePassword = function (candidatePassword, callback) {
  bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
    // Pass error into callback
    if (err) {
      return callback(err);
    }

    // Callback function with result of comparison
    callback(null, isMatch);
  });
};

// Manage login attempts
UserSchema.methods.incLoginAttempts = function (callback) {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    // Run update and call the callback
    return this.updateOne(
      {
        $set: { loginAttempts: 1 },
        $unset: { lockUntil: 1 },
      },
      callback
    );
  }

  // Otherwise increment
  var updates = { $inc: { loginAttempts: 1 } };

  // Lock the user if incrementing hits max attempts
  if (
    this.loginAttempts + 1 >= parseInt(process.env.MAX_LOGIN_ATTEMPTS) &&
    !this.isLocked
  ) {
    updates.$set = {
      lockUntil: Date.now() + parseInt(process.env.LOCK_TIME),
    };
  }

  // Make updates
  return this.updateOne(updates, callback);
};

// Static reasons for failed auth
var reasons = (UserSchema.statics.failedLogin = {
  NOT_FOUND: 0,
  PASSWORD_INCORRECT: 1,
  MAX_ATTEMPTS: 2,
});

// Authenticate user
UserSchema.statics.getAuthenticated = function (email, password, callback) {
  this.findOne({ email: email }, function (err, user) {
    // Return serious db error
    if (err) {
      return callback(err);
    }

    // Return reason for auth failure
    if (!user) {
      return callback(null, null, reasons.NOT_FOUND);
    }

    // We found a user, check if locked
    if (user.isLocked) {
      return user.incLoginAttempts(function (err) {
        // Pass up serious db err from increment
        if (err) {
          return callback(err);
        }
        // Pass up no errors but failed auth b/c of lockout
        return callback(null, null, reasons.MAX_ATTEMPTS);
      });
    }

    // User with no lock, check password
    user.comparePassword(password, function (err, isMatch) {
      // Pass up serious db err from compare
      if (err) {
        return callback(err);
      }

      // check for match
      if (isMatch) {
        // Nothing to reset, return the user
        if (!user.loginAttempts && !user.lockUntil) {
          return callback(null, user);
        }

        // We need to reset login attempts and unset lock value
        var updates = {
          $set: { loginAttempts: 1 },
          $unset: { lockUntil: 1 },
        };

        // Make resets and pass up user
        return user.updateOne(updates, function (err) {
          // Pass up serious db err from compare
          if (err) {
            return callback(err);
          }

          return callback(null, user);
        });
      }

      // No match, increment login attempts
      user.incLoginAttempts(function (err) {
        if (err) {
          return callback(err);
        }

        return callback(null, null, reasons.PASSWORD_INCORRECT);
      });
    });
  });
};

module.exports = mongoose.model("User", UserSchema);
