var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SessionSchema = new Schema({
  game: { type: Schema.Types.ObjectId, ref: "Game" },
  date: { type: String, required: true },
  time: { type: String, required: true },
  address: { type: String, required: true },
  rsvp_map: { type: Map, of: String },
});

module.exports = mongoose.model("Session", SessionSchema);
