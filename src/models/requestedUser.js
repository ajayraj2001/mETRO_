const mongoose = require("mongoose");
const { Schema } = mongoose;

const requestedUserSchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userRequestedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["Ignore", "Accept", "Requested"], default: "Requested" },
  createdAt: { type: Date, default: Date.now },
});

const RequestedUser = mongoose.model("RequestedUser", requestedUserSchema);

module.exports = RequestedUser;
