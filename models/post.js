var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var PostSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  game: { type: Schema.Types.ObjectId, ref: "Game", required: true },
  body: { type: String, maxLength: 140, required: true },
  date: { type: Date, required: true },
});

module.exports = mongoose.model("Post", PostSchema);
