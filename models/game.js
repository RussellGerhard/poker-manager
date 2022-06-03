var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var GameSchema = new Schema({
  name: { type: String, required: true, maxlength: 25 },
  game_type: { type: String, required: true, default: "No Limit Hold'em" },
  stakes: { type: String },
  date: { type: Date },
  time: { type: Date },
  address: { type: String },
  rsvp_list: [{ type: Schema.Types.ObjectId, ref: "User" }],
  members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  admin: { type: Schema.Types.ObjectId, ref: "User" },
  message_board: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  locked: { type: Boolean, required: true, default: true },
});

GameSchema.virtual("url").get(function () {
  return "/game/" + this._id;
});

module.exports = mongoose.model("Game", GameSchema);
