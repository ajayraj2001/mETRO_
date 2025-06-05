const mongoose = require("mongoose");
const { Schema } = mongoose;

const LikeSchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userLikedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: () => new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000) }
});

LikeSchema.index({ user: 1, userLikedTo: 1 }, { unique: true });

const Like = mongoose.model('Like', LikeSchema);
module.exports = Like;