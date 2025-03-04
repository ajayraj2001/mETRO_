// models/UserSubscription.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSubscriptionSchema = new Schema({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },
  plan: { 
    type: Schema.Types.ObjectId, 
    ref: "SubscriptionPlan", 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  billingCycle: { 
    type: String, 
    enum: ["monthly", "quarterly", "annual"], 
    required: true 
  },
  autoRenew: { 
    type: Boolean, 
    default: true 
  },
  featuresConsumed: {
    contactViewsUsed: { type: Number, default: 0 },
    superInterestsUsed: { type: Number, default: 0 }
  },
  status: { 
    type: String, 
    enum: ["active", "expired", "canceled"], 
    default: "active" 
  },
  paymentStatus: { 
    type: String, 
    enum: ["paid", "pending", "failed"], 
    default: "paid" 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster querying
userSubscriptionSchema.index({ endDate: 1 });
userSubscriptionSchema.index({ status: 1 });

// Pre-save hook
userSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if subscription is active
userSubscriptionSchema.methods.isActive = function() {
  return this.status === "active" && this.endDate > new Date();
};

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);