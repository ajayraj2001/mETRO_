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
  transaction: {
    type: Schema.Types.ObjectId,
    ref: "Transaction",
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
  status: { 
    type: String, 
    enum: ["active", "expired", "canceled"], 
    default: "active" 
  },
  featuresConsumed: {
    contactViews: { type: Number, default: 0 },
    superInterests: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSubscriptionSchema.index({ endDate: 1 });
userSubscriptionSchema.index({ status: 1 });

userSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);