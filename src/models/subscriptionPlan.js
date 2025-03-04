const mongoose = require("mongoose");
const { Schema } = mongoose;

const subscriptionPlanSchema = new Schema({
  planName: { 
    type: String, 
    enum: ['Silver', 'Gold', 'Platinum', 'Royal'], 
    required: true 
  },
  pricing: {
    monthly: {
      actual: { type: Number, required: true },
      discounted: { type: Number, required: true }
    },
    quarterly: {
      actual: { type: Number, required: true },
      discounted: { type: Number, required: true }
    },
    annual: {
      actual: { type: Number, required: true },
      discounted: { type: Number, required: true }
    }
  },
  features: {
    contactViews: {
      total: { type: Number, required: true },
      description: { type: String, default: "Total contacts you can access" }
    },
    profileVisibility: {
      type: { type: String, enum: ['Standard', 'Enhanced', 'Premium', 'VIP'] },
      multiplier: { type: Number, default: 1 },
      description: { type: String }
    },
    superInterest: {
      total: { type: Number },
      description: { type: String, default: "Get noticed faster with prime placement" }
    },
    sharpFinder: {
      included: { type: Boolean, default: false },
      tier: { type: String, enum: ['None', 'Basic', 'Advanced', 'Premium'], default: 'None' },
      description: { type: String, default: "Sort matches by relevance and compatibility" }
    },
    rmManager: {  // New relationship manager field
      included: { type: Boolean, default: false },
      accessLevel: { type: String, enum: ['None', 'Basic', 'Premium'], default: 'None' }
    },
    specialFeatures: [{
      name: { type: String },
      included: { type: Boolean, default: false },
      description: { type: String }
    }]
  },
  displayOrder: { type: Number, default: 0 },
  isPopular: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to update the updatedAt field
subscriptionPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
module.exports = SubscriptionPlan;