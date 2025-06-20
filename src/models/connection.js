
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Renamed from RequestedUser to Connection for clarity
const connectionSchema = new Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Declined", "Blocked"],
    default: "Pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });

// Index for status-based queries
connectionSchema.index({ status: 1 });

const Connection = mongoose.model("Connection", connectionSchema);

module.exports = Connection;