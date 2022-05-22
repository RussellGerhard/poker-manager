var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var bcrypt = require("bcrypt");
var async = require("async");

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

module.exports = mongoose.model("User", UserSchema);
