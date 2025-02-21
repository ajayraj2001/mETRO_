const mongoose = require("mongoose");
const { Schema } = mongoose;

const LikeSchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userLikedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});

const Like = mongoose.model('Like', LikeSchema);
module.exports = Like;