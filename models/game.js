var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var GameSchema = new Schema({
  name: { type: String, required: true, maxlength: 25 },
  game_type: { type: String },
  stakes: { type: String },
  max_buyin: { type: String },
  venmoEnabled: { type: Boolean },
  bankerVenmo: { type: String },
  venmoMessage: { type: String, default: "Flowers...", maxLength: 50 },
  session: {
    type: Schema.Types.ObjectId,
    ref: "Session",
  },
  // There's a better way to do this by populating map keys
  members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  member_profit_map: { type: Map, of: Number },
  admin: { type: Schema.Types.ObjectId, ref: "User" },
});

GameSchema.virtual("url").get(function () {
  return "/games/" + this._id;
});

module.exports = mongoose.model("Game", GameSchema);
