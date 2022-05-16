var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SessionSchema = new Schema({
  players: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  game: { type: Schema.Types.ObjectId, ref: "Game", required: true },
  game_type: { type: String, required: true, default: "No Limit Hold'em" },
  stakes: { type: String },
  start_time: { type: Date },
  //   address maybe?
  url: { type: String, required: true },
  locked: { type: Boolean, required: true, default: true },
});

module.exports = mongoose.model("Session", SessionSchema);
