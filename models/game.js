var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var GameSchema = new Schema({
  name: { type: String, required: true, maxlength: 25 },
  current_session: { type: Schema.Types.ObjectId, ref: "Session" },
  members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  message_board: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  session_log: [{ type: Schema.Types.ObjectId, ref: "Session" }],
  url: { type: String, required: true },
});

module.exports = mongoose.model("Game", GameSchema);
