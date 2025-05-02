
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

// Add method to check if users can message each other
// connectionSchema.statics.canMessage = async function(userId1, userId2) {
//   const connection = await this.findOne({
//     $or: [
//       { sender: userId1, receiver: userId2, status: "Accepted" },
//       { sender: userId2, receiver: userId1, status: "Accepted" }
//     ]
//   });
//   return !!connection;
// };

const Connection = mongoose.model("Connection", connectionSchema);

module.exports = Connection;