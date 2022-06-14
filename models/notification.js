var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var NotificationSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
  game: { type: Schema.Types.ObjectId, ref: "Game" },
  label: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: Date, required: true },
});

module.exports = mongoose.model("Notification", NotificationSchema);
