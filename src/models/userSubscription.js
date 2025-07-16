const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSubscriptionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  features: {
    chat: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      isUnlimited: { type: Boolean, default: false }
    },
    contactViews: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 }
    },
    superInterest: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 }
    },
    profileVisibility: {
      multiplier: { type: Number, default: 1 }
    },
    verifiedBadge: {
      active: { type: Boolean, default: false }
    },
    rmManager: {
      active: { type: Boolean, default: false },
      managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
    }
  },
  payment: {
    transactionId: { type: String },
    orderId: { type: String },
    amount: { type: Number },
    currency: { type: String, default: 'INR' },
    method: { type: String },
    gateway: { type: String, default: 'razorpay' },
    gatewayPaymentId: { type: String },
    gatewayOrderId: { type: String },
    gatewaySignature: { type: String },
    status: { 
      type: String, 
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    receiptId: { type: String },
  },
  autoRenewal: {
    enabled: { type: Boolean, default: false },
    subscriptionId: { type: String, default: null }
  },
  renewalHistory: [{
    previousSubscriptionId: { type: Schema.Types.ObjectId, ref: 'UserSubscription' },
    renewedAt: { type: Date },
    paymentId: { type: String }
  }],
  couponApplied: {
    code: { type: String },
    discountAmount: { type: Number },
    discountType: { type: String, enum: ['percentage', 'fixed'] }
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  collection: 'user_subscriptions'
});

// Indexing for faster queries
userSubscriptionSchema.index({ userId: 1 });
userSubscriptionSchema.index({ status: 1 });
userSubscriptionSchema.index({ endDate: 1 });
// userSubscriptionSchema.index({ 'payment.transactionId': 1 });
// userSubscriptionSchema.index({ 'payment.gatewayPaymentId': 1 });

// Method to check if subscription is active
userSubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && this.endDate > new Date();
};

// Method to check if a feature is available
userSubscriptionSchema.methods.hasFeatureAvailable = function(featureName, count = 1) {
  if (!this.isActive()) return false;
  
  // For unlimited features
  if (featureName === 'chat' && this.features.chat.isUnlimited) return true;
  
  // For counted features
  if (this.features[featureName] && 
      (this.features[featureName].total - this.features[featureName].used) >= count) {
    return true;
  }
  
  // For boolean features
  if (featureName === 'verifiedBadge' || featureName === 'rmManager') {
    return this.features[featureName].active;
  }
  
  return false;
};

// Method to use a feature
userSubscriptionSchema.methods.useFeature = function(featureName, count = 1) {
  if (!this.isActive()) return false;
  
  // Skip for unlimited features
  if (featureName === 'chat' && this.features.chat.isUnlimited) return true;
  
  // For counted features
  if (this.features[featureName] && 
      (this.features[featureName].total - this.features[featureName].used) >= count) {
    this.features[featureName].used += count;
    return true;
  }
  
  return false;
};

const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);
module.exports = UserSubscription;