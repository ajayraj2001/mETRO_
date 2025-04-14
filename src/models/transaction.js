const mongoose = require("mongoose");
const { Schema } = mongoose;

const transactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscriptionPlanId: {
    type: Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayOrderId: {
    type: String,
    sparse: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true
  },
  razorpaySignature: {
    type: String,
    sparse: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'attempted', 'paid', 'failed', 'cancelled', 'expired'],
    default: 'created'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  features: {
    contactViewsRemaining: { type: Number, default: 0 },
    superInterestsRemaining: { type: Number, default: 0 },
    chatEnabled: { type: Boolean, default: false },
    profileVisibilityMultiplier: { type: Number, default: 1 },
    verifiedBadge: { type: Boolean, default: false },
    rmManagerEnabled: { type: Boolean, default: false }
  },
  receipt: {
    type: String
  },
  notes: {
    type: Object,
    default: {}
  },
  paymentAttempts: [{
    timestamp: { type: Date },
    status: { type: String },
    message: { type: String }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field on every save
transactionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// We only want to index active subscriptions
// transactionSchema.index({ userId: 1, status: 1 });
// // Index for finding valid subscriptions by end date
// transactionSchema.index({ userId: 1, status: 1, endDate: 1 });
// // Index for order lookup
// transactionSchema.index({ orderId: 1 });
// // Index for Razorpay payment ID lookup
// transactionSchema.index({ razorpayPaymentId: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;