var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var TokenSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 360000,
  },
});

module.exports = mongoose.model("Token", TokenSchema);
