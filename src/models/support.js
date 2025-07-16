const mongoose = require("mongoose");
const { Schema } = mongoose;

const supportSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User" },
  query: { type: String },
  answer: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Support = mongoose.model("Support", supportSchema);
module.exports = Support;
