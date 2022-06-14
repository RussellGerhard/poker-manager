var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SessionSchema = new Schema({
  date: { type: String, required: true },
  time: { type: String, required: true },
  address: { type: String, required: true },
  rsvp_list: [
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      response: { type: String },
    },
  ],
});

module.exports = mongoose.model("Session", SessionSchema);
