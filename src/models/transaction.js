const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
  orderId: { type: String, required: true },
  price: { type: Number, default: 0 },
  currency: { type: String, default: "INR" },
  paymentId: { type: String },
  orderStatus: { type: String, default: "pending" },
  //  Plan Details
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  status: { type: String, enum: ["Active", "Expired", "Canceled"], default: "Active" },
  createdAt: { type: Date, default: Date.now },
});

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
