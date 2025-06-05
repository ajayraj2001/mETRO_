
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: () => new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000) },
  status: { type: String, enum: ['pending', 'sent', 'delivered', 'read'], default: 'pending' },
  isRead: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  deletedForEveryone: { type: Boolean, default: false },
  deletedForUser: { type: Boolean, default: false },
});

messageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
