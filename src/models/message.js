const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  deletedForEveryone: { type: Boolean, default: false },
  deletedForUser: { type: Boolean, default: false },
});

// Create an index for faster retrieval based on sender and recipient
messageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
