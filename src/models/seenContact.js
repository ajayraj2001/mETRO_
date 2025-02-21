const mongoose = require("mongoose");

const seenContactSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  contactSeen: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const SeenContact = mongoose.model("SeenContact", seenContactSchema);

module.exports = SeenContact;
