var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var bcrypt = require("bcrypt");

var UserSchema = new Schema({
  // Basic user info
  name: { type: String, required: true, maxLength: 25 },
  email: {
    type: String,
    required: true,
    maxLength: 25,
    index: { unique: true },
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

module.exports = mongoose.model("User", UserSchema);
