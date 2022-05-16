var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var NotificationSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  date: { type: Date, required: true },
  new: { type: Boolean, required: true },
});

module.exports = mongoose.model("Notification", NotificationSchema);
