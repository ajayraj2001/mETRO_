const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  plan: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "SubscriptionPlan", 
    required: true 
  },
  razorpayOrderId: { 
    type: String, 
    required: true 
  },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: "INR" 
  },
  status: { 
    type: String, 
    enum: ["created", "attempted", "paid", "failed", "refunded"], 
    default: "created" 
  },
  paymentMethod: { 
    type: String, 
    enum: ["credit_card", "debit_card", "netbanking", "upi", "wallet"] 
  },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);