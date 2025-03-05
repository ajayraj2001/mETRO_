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
    required: true,
    default: Date.now
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
    enum: ["active", "expired", "canceled", "pending_upgrade", "grace_period"], 
    default: "active" 
  },
  renewalType: {
    type: String,
    enum: ["auto", "manual", "one_time"],
    default: "auto"
  },
  nextSubscription: {
    type: Schema.Types.ObjectId,
    ref: "UserSubscription",
    default: null
  },
  previousSubscription: {
    type: Schema.Types.ObjectId,
    ref: "UserSubscription",
    default: null
  },
  featuresConsumed: {
    contactViews: { type: Number, default: 0 },
    superInterests: { type: Number, default: 0 },
    remainingFeatures: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  additionalBenefits: [{
    type: {
      name: String,
      description: String,
      expiryDate: Date
    }
  }],
  upgradeHistory: [{
    type: {
      fromPlan: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      toPlan: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      upgradeDate: { type: Date, default: Date.now },
      effectiveFrom: { type: Date },
      reason: String
    }
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ endDate: 1 });
userSubscriptionSchema.index({ status: 1, endDate: 1 });

// Pre-save hook to update timestamps
userSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if subscription is active
userSubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && new Date() <= this.endDate;
};

// Method to handle subscription upgrade
userSubscriptionSchema.methods.upgrade = async function(newPlan, transaction) {
  // If current subscription is still active, set as previous
  if (this.isActive()) {
    // Create a new subscription that starts after current subscription ends
    const newSubscription = new mongoose.model('UserSubscription')({
      user: this.user,
      plan: newPlan._id,
      transaction: transaction._id,
      startDate: this.endDate,
      endDate: new Date(this.endDate.getTime() + newPlan.duration),
      billingCycle: this.billingCycle,
      status: 'active',
      previousSubscription: this._id,
      renewalType: 'manual'
    });

    // Update current subscription
    this.status = 'expired';
    this.nextSubscription = newSubscription._id;

    // Save both subscriptions
    await this.save();
    await newSubscription.save();

    return newSubscription;
  }

  // If current subscription is expired, just create a new one
  return new mongoose.model('UserSubscription')({
    user: this.user,
    plan: newPlan._id,
    transaction: transaction._id,
    startDate: new Date(),
    endDate: new Date(Date.now() + newPlan.duration),
    billingCycle: this.billingCycle,
    status: 'active',
    previousSubscription: this._id,
    renewalType: 'manual'
  });
};

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);



const mongoose = require('mongoose');
const UserSubscription = require('./models/UserSubscription');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const Transaction = require('./models/Transaction');
const User = require('./models/User');

class SubscriptionService {
  /**
   * Find active subscription for a user
   * @param {string} userId - ID of the user
   * @returns {Promise<UserSubscription|null>} Active subscription or null
   */
  static async findActiveSubscription(userId) {
    return UserSubscription.findOne({
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() }
    }).populate('plan');
  }

  /**
   * Handle subscription upgrade
   * @param {string} userId - ID of the user
   * @param {string} newPlanId - ID of the new subscription plan
   * @param {Object} transactionData - Transaction details
   * @returns {Promise<UserSubscription>} New active subscription
   */
  static async upgradeSubscription(userId, newPlanId, transactionData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find user and new plan
      const user = await User.findById(userId);
      const newPlan = await SubscriptionPlan.findById(newPlanId);

      if (!user || !newPlan) {
        throw new Error('User or Plan not found');
      }

      // Find current active subscription
      const currentSubscription = await UserSubscription.findOne({
        user: userId,
        status: 'active',
        endDate: { $gt: new Date() }
      });

      // Create transaction
      const transaction = new Transaction({
        user: userId,
        plan: newPlanId,
        amount: newPlan.pricing.discounted,
        status: 'paid',
        ...transactionData
      });

      // Handle subscription upgrade logic
      let newSubscription;
      if (currentSubscription) {
        // If current subscription exists and is active
        newSubscription = await currentSubscription.upgrade(newPlan, transaction);
      } else {
        // If no active subscription, create a new one
        newSubscription = new UserSubscription({
          user: userId,
          plan: newPlanId,
          transaction: transaction._id,
          startDate: new Date(),
          endDate: new Date(Date.now() + newPlan.duration),
          billingCycle: transactionData.billingCycle || 'monthly',
          status: 'active'
        });
      }

      // Save transaction and new subscription
      await transaction.save({ session });
      await newSubscription.save({ session });

      // Update user's subscription reference
      user.subscription = newSubscription._id;
      await user.save({ session });

      await session.commitTransaction();
      session.endTransaction();

      return newSubscription.populate('plan');
    } catch (error) {
      await session.abortTransaction();
      session.endTransaction();
      throw error;
    }
  }

  /**
   * Process subscription expiration
   * @param {string} subscriptionId - ID of the subscription to process
   */
  static async processSubscriptionExpiration(subscriptionId) {
    const subscription = await UserSubscription.findById(subscriptionId);
    
    if (!subscription || subscription.status !== 'active') {
      return;
    }

    // Move to grace period or expire
    if (subscription.renewalType === 'auto') {
      // Enter grace period for auto-renewal
      subscription.status = 'grace_period';
      subscription.metadata.gracePeriodEnds = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3 days grace
    } else {
      // Directly expire for manual or one-time subscriptions
      subscription.status = 'expired';
    }

    await subscription.save();

    // Optionally send notification to user
    await this.sendExpirationNotification(subscription.user);
  }

  /**
   * Send expiration notification
   * @param {string} userId - ID of the user
   */
  static async sendExpirationNotification(userId) {
    // Implement notification logic (email, push notification, etc.)
    // This is a placeholder for actual notification implementation
    console.log(`Sending expiration notification to user ${userId}`);
  }

  /**
   * Get user's subscription benefits
   * @param {string} userId - ID of the user
   * @returns {Promise<Object>} User's current subscription benefits
   */
  static async getUserSubscriptionBenefits(userId) {
    const activeSubscription = await this.findActiveSubscription(userId);
    
    if (!activeSubscription) {
      // Default benefits for non-subscribers
      return {
        profileVisibility: 'Standard',
        contactViewsRemaining: 3,
        superInterests: 0,
        verifiedBadge: false
      };
    }

    return {
      profileVisibility: activeSubscription.plan.features.profileVisibility.type,
      contactViewsRemaining: activeSubscription.featuresConsumed.contactViews,
      superInterests: activeSubscription.featuresConsumed.superInterests,
      verifiedBadge: activeSubscription.plan.features.verifiedBadge.included
    };
  }
}

module.exports = SubscriptionService;