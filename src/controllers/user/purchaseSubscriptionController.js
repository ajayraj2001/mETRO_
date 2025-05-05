const User = require('../../models/user');
const SubscriptionPlan = require('../../models/subscriptionPlan');
const UserSubscription = require('../../models/userSubscription');
const PaymentTransaction = require('../../models/transaction');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Initialize Razorpay with your key_id and key_secret
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const subscriptionController = {
  // Get all subscription plans
  getSubscriptionPlans: async (req, res) => {
    try {
      const plans = await SubscriptionPlan.find({ active: true }).sort({ displayOrder: 1 });
      return res.status(200).json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get user's current subscription
  getUserSubscription: async (req, res) => {
    try {
      const userId = req.user._id;

      // Find the latest active subscription for the user
      const subscription = await UserSubscription.findOne({
        userId: userId,
        status: 'active',
        endDate: { $gt: new Date() }
      }).populate('planId', 'planName durationInMonths').sort({ created_at: -1 });

      if (!subscription) {
        return res.status(200).json({
          success: true,
          hasActiveSubscription: false,
          data: null,
          message: 'No active subscription found'
        });
      }

      // Calculate remaining feature usage
      const featureUsage = {
        chat: {
          total: subscription.features.chat.total,
          used: subscription.features.chat.used,
          remaining: subscription.features.chat.isUnlimited ? 'Unlimited' :
            (subscription.features.chat.total - subscription.features.chat.used),
          isUnlimited: subscription.features.chat.isUnlimited
        },
        contactViews: {
          total: subscription.features.contactViews.total,
          used: subscription.features.contactViews.used,
          remaining: subscription.features.contactViews.total - subscription.features.contactViews.used
        },
        superInterest: {
          total: subscription.features.superInterest.total,
          used: subscription.features.superInterest.used,
          remaining: subscription.features.superInterest.total - subscription.features.superInterest.used
        },
        profileVisibility: {
          multiplier: subscription.features.profileVisibility.multiplier
        },
        verifiedBadge: {
          active: subscription.features.verifiedBadge.active
        },
        rmManager: {
          active: subscription.features.rmManager.active
        }
      };

      // Calculate days remaining
      const today = new Date();
      const endDate = new Date(subscription.endDate);
      const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      return res.status(200).json({
        success: true,
        hasActiveSubscription: true,
        data: {
          subscription,
          featureUsage,
          daysRemaining,
          expiryDate: subscription.endDate
        }
      });

    } catch (error) {
      console.error('Error fetching user subscription:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Create order for subscription purchase
  createSubscriptionOrder: async (req, res) => {
    try {
      const { planId } = req.body;
      const userId = req.user._id;

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required'
        });
      }

      // Check if plan exists
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Subscription plan not found'
        });
      }

      // Check if user already has an active subscription
      const activeSubscription = await UserSubscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
      });

      // Generate a unique receipt id
      const receiptId = `JODI4EVER_${uuidv4().substring(0, 8)}_${Date.now()}`;

      // Create Razorpay order
      // const amount = plan.price.discounted * 100; // Amount in paisa
      // const currency = 'INR';

      const orderAmount = plan.price.discounted;
      const gstAmount = orderAmount * 0.18;
      const totalAmount = orderAmount + gstAmount;

      // Razorpay amount in paisa
      const razorpayAmount = totalAmount * 100;

      const order = await razorpay.orders.create({
        amount: razorpayAmount,
        currency,
        receipt: receiptId,
        notes: {
          userId: userId.toString(),
          planId: planId,
          planName: plan.planName,
          durationInMonths: plan.durationInMonths
        }
      });

      // Create a pending payment transaction
      const transaction = new PaymentTransaction({
        userId,
        // subscriptionId: activeSubscription._id,
        type: activeSubscription ? 'subscription_upgrade' : 'subscription_purchase',
        orderAmount: orderAmount,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        currency: 'INR',
        gateway: 'razorpay',
        status: 'initiated',
        gatewayData: {
          orderId: order.id,
          receiptId
        },
        metadata: {
          planId: plan._id,
          planName: plan.planName,
          durationInMonths: plan.durationInMonths,
          originalAmount: plan.price.actual,
          discountAmount: plan.price.actual - plan.price.discounted,
          taxAmount: gstAmount
        }
      });

      await transaction.save();

      return res.status(200).json({
        success: true,
        message: "Order Created successfully",
        data: order.id
      });

    } catch (error) {
      console.error('Error creating subscription order:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Verify payment and activate subscription
  verifyPayment: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing payment verification parameters'
        });
      }

      // Verify the payment signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature'
        });
      }

      // Get payment details from Razorpay
      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      // Update the transaction
      const transaction = await PaymentTransaction.findOne({
        'gatewayData.orderId': razorpay_order_id
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Update transaction with payment details
      transaction.status = payment.status === 'captured' ? 'completed' : 'failed';
      transaction.gatewayData.paymentId = razorpay_payment_id;
      transaction.gatewayData.signature = razorpay_signature;
      transaction.gatewayData.method = payment.method;

      // Set method specific details
      if (payment.method === 'card') {
        transaction.gatewayData.bank = payment.bank;
      } else if (payment.method === 'wallet') {
        transaction.gatewayData.wallet = payment.wallet;
      } else if (payment.method === 'upi') {
        transaction.gatewayData.upi = payment.upi;
        transaction.gatewayData.vpa = payment.vpa;
      }

      await transaction.save({ session });

      // If payment is successful, create or update the subscription
      if (payment.status === 'captured') {
        const userId = transaction.userId;
        const planId = transaction.metadata.planId;

        // Get the plan details
        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
          throw new Error('Subscription plan not found');
        }

        // Check if user already has an active subscription
        const existingSubscription = await UserSubscription.findOne({
          userId,
          status: 'active',
          endDate: { $gt: new Date() }
        });

        let startDate = new Date();
        let endDate = new Date();
        endDate.setMonth(endDate.getMonth() + plan.durationInMonths);

        // If user has an existing subscription, extend it or upgrade it
        if (existingSubscription) {
          // If upgrading to a better plan, start the new subscription immediately
          if (plan.displayOrder > existingSubscription.planId.displayOrder) {
            // Mark old subscription as cancelled
            existingSubscription.status = 'cancelled';
            await existingSubscription.save({ session });

            // Use the features from the new plan
          } else {
            // If extending the same plan, add duration to the existing end date
            startDate = existingSubscription.endDate;
            endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + plan.durationInMonths);

            // Mark old subscription as expired
            existingSubscription.status = 'expired';
            await existingSubscription.save({ session });
          }
        }

        // Create new subscription
        const newSubscription = new UserSubscription({
          userId,
          planId,
          status: 'active',
          startDate,
          endDate,
          features: {
            chat: {
              total: plan.features.chat.total,
              used: 0,
              isUnlimited: plan.features.chat.isUnlimited
            },
            contactViews: {
              total: plan.features.contactViews.total,
              used: 0
            },
            superInterest: {
              total: plan.features.superInterest.total,
              used: 0
            },
            profileVisibility: {
              multiplier: plan.features.profileVisibility.multiplier
            },
            verifiedBadge: {
              active: plan.features.verifiedBadge.included
            },
            rmManager: {
              active: plan.features.rmManager.included
            }
          },
          payment: {
            transactionId: transaction._id,
            orderId: razorpay_order_id,
            amount: transaction.totalAmount,
            currency: transaction.currency,
            method: payment.method,
            gateway: 'razorpay',
            gatewayPaymentId: razorpay_payment_id,
            gatewayOrderId: razorpay_order_id,
            gatewaySignature: razorpay_signature,
            status: 'completed',
            receiptId: transaction.gatewayData.receiptId
          }
        });

        // Immediately update the user document  --- just added
        await User.findByIdAndUpdate(userId, {
          verifiedBadge: plan.features.verifiedBadge.included,
          subscriptionStatus: 'active',
          subscriptionPlan: plan.planName,
          subscriptionExpiry: newSubscription.endDate,
          messageCreditsRemaining: plan.features.chat.isUnlimited ? -1 : plan.features.chat.total,
          contactViewsRemaining: plan.features.contactViews.total,
          superInterestsRemaining: plan.features.superInterest.total,
          unlimitedMessaging: plan.features.chat.isUnlimited,
          profileVisibilityBoost: plan.features.profileVisibility.multiplier,
          lastSubscriptionCheck: new Date()
        });

        // If continuing from a previous subscription, add to renewal history
        if (existingSubscription) {
          newSubscription.renewalHistory.push({
            previousSubscriptionId: existingSubscription._id,
            renewedAt: new Date(),
            paymentId: razorpay_payment_id
          });
        }

        await newSubscription.save({ session });

        // Update the transaction with subscription id
        transaction.subscriptionId = newSubscription._id;
        await transaction.save({ session });

        // Update user document to add verified badge
        if (plan.features.verifiedBadge.included) {
          await User.findByIdAndUpdate(userId, {
            $set: { verifiedBadge: true }
          }, { session });
        }

        await session.commitTransaction();

        return res.status(200).json({
          success: true,
          message: 'Payment verified and subscription activated successfully',
          data: {
            subscription: newSubscription,
            transaction
          }
        });

      } else {
        // If payment failed
        await session.commitTransaction();

        return res.status(400).json({
          success: false,
          message: 'Payment failed',
          data: {
            transaction
          }
        });
      }

    } catch (error) {
      await session.abortTransaction();
      console.error('Error verifying payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    } finally {
      session.endSession();
    }
  },

  // Cancel subscription
  cancelSubscription: async (req, res) => {
    try {
      const userId = req.user._id;

      const subscription = await UserSubscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      // If auto-renewal is enabled, cancel it in payment gateway
      if (subscription.autoRenewal && subscription.autoRenewal.enabled &&
        subscription.autoRenewal.subscriptionId) {
        try {
          await razorpay.subscriptions.cancel(subscription.autoRenewal.subscriptionId);
        } catch (err) {
          console.error('Error cancelling auto-renewal in Razorpay:', err);
          // Continue with cancellation even if Razorpay fails
        }
      }

      // Update subscription
      subscription.autoRenewal.enabled = false;
      subscription.status = 'cancelled';
      await subscription.save();

      // Remove verified badge from user
      await User.findByIdAndUpdate(userId, {
        $set: { verifiedBadge: false }
      });

      return res.status(200).json({
        success: true,
        message: 'Subscription cancelled successfully'
      });

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Setup subscription auto-renewal
  setupAutoRenewal: async (req, res) => {
    try {
      const userId = req.user._id;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required'
        });
      }

      // Check if plan exists
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Subscription plan not found'
        });
      }

      // Check if user already has an active subscription
      const activeSubscription = await UserSubscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
      });

      if (!activeSubscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found. Please purchase a subscription first.'
        });
      }

      // Check if auto-renewal is already enabled
      if (activeSubscription.autoRenewal.enabled && activeSubscription.autoRenewal.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'Auto-renewal is already enabled for this subscription'
        });
      }

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Create a Razorpay customer if not already exists
      let customerId;

      // Try to fetch existing customer by email
      try {
        const customers = await razorpay.customers.all();
        const existingCustomer = customers.items.find(customer =>
          customer.email === user.email || customer.contact === user.phone
        );

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          // Create a new customer
          const customer = await razorpay.customers.create({
            name: user.fullName,
            email: user.email,
            contact: user.phone,
            notes: {
              userId: userId.toString()
            }
          });

          customerId = customer.id;
        }
      } catch (error) {
        console.error('Error creating/fetching Razorpay customer:', error);
        return res.status(500).json({
          success: false,
          message: 'Error setting up auto-renewal',
          error: error.message
        });
      }

      // Create a subscription plan in Razorpay
      // Inside setupAutoRenewal function
      const orderAmount = plan.price.discounted;
      const gstAmount = orderAmount * 0.18;
      const totalAmount = orderAmount + gstAmount;

      const item = {
        name: `${plan.planName} Plan - ${plan.durationInMonths} Month${plan.durationInMonths > 1 ? 's' : ''}`,
        amount: totalAmount * 100, // Include GST in Razorpay plan
        currency: 'INR',
        description: `Auto-renewal for ${plan.planName} Plan`
      };

      // Calculate subscription period based on duration
      let period = 'monthly';
      let interval = 1;

      if (plan.durationInMonths === 3) {
        period = 'monthly';
        interval = 3;
      } else if (plan.durationInMonths === 6) {
        period = 'monthly';
        interval = 6;
      } else if (plan.durationInMonths === 12) {
        period = 'yearly';
        interval = 1;
      }

      try {
        // Create a Razorpay plan
        const razorpayPlan = await razorpay.plans.create({
          period,
          interval,
          item
        });

        // Create a Razorpay subscription
        const razorpaySubscription = await razorpay.subscriptions.create({
          plan_id: razorpayPlan.id,
          customer_id: customerId,
          total_count: 12, // Limit to 12 renewals (can be adjusted)
          notes: {
            userId: userId.toString(),
            planId: planId,
            planName: plan.planName,
            durationInMonths: plan.durationInMonths
          }
        });

        // Update user subscription with auto-renewal info
        activeSubscription.autoRenewal = {
          enabled: true,
          subscriptionId: razorpaySubscription.id
        };

        await activeSubscription.save();

        return res.status(200).json({
          success: true,
          message: 'Auto-renewal setup successfully',
          data: {
            subscription: activeSubscription,
            razorpaySubscriptionId: razorpaySubscription.id
          }
        });

      } catch (error) {
        console.error('Error setting up Razorpay auto-renewal:', error);
        return res.status(500).json({
          success: false,
          message: 'Error setting up auto-renewal',
          error: error.message
        });
      }
    } catch (error) {
      console.error('Error setting up auto-renewal:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get payment history for a user
  getPaymentHistory: async (req, res) => {
    try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const transactions = await PaymentTransaction.find({
        userId,
        status: { $in: ['completed', 'refunded'] }
      })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('metadata.planId', 'planName durationInMonths');

      const total = await PaymentTransaction.countDocuments({
        userId,
        status: { $in: ['completed', 'refunded'] }
      });

      return res.status(200).json({
        success: true,
        data: {
          transactions,
          pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit
          }
        }
      });

    } catch (error) {
      console.error('Error fetching payment history:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Webhook handler for Razorpay events
  webhookHandler: async (req, res) => {
    try {
      // Verify webhook signature
      const webhookSignature = req.headers['x-razorpay-signature'];
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      const payload = req.body;

      if (!webhookSignature || !webhookSecret) {
        console.error('Missing webhook signature or secret');
        return res.status(400).json({
          success: false,
          message: 'Missing webhook signature or secret'
        });
      }

      // Verify the webhook signature
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (generatedSignature !== webhookSignature) {
        console.error('Invalid webhook signature');
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      // Handle different webhook events
      const event = payload.event;

      switch (event) {
        case 'payment.authorized':
          // Payment was authorized but not captured yet
          console.log('Payment authorized:', payload);
          break;

        case 'payment.captured':
          // Payment was captured successfully
          await handlePaymentCaptured(payload);
          break;

        case 'payment.failed':
          // Payment failed
          await handlePaymentFailed(payload);
          break;

        case 'refund.created':
          // Refund was initiated
          await handleRefundCreated(payload);
          break;

        case 'subscription.charged':
          // Auto-renewal subscription was charged
          await handleSubscriptionCharged(payload);
          break;

        case 'subscription.cancelled':
          // Subscription was cancelled
          await handleSubscriptionCancelled(payload);
          break;

        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      // Always respond with 200 to acknowledge receipt of the webhook
      return res.status(200).json({
        success: true,
        message: 'Webhook received and processed'
      });

    } catch (error) {
      console.error('Error processing webhook:', error);
      // Still return 200 to acknowledge receipt, even if there was an error processing
      return res.status(200).json({
        success: true,
        message: 'Webhook received but error during processing'
      });
    }
  }
};

// Helper functions for webhook handling
async function handleRefundCreated(payload) {
  const refund = payload.payload.refund.entity;
  const paymentId = refund.payment_id;

  try {
    // Find the transaction using the payment ID
    const transaction = await PaymentTransaction.findOne({
      'gatewayData.paymentId': paymentId
    });

    if (!transaction) {
      console.error(`Transaction not found for payment ID: ${paymentId}`);
      return;
    }

    // Inside handleRefundCreated function
    const refundAmountINR = refund.amount / 100;
    const orderAmount = parseFloat((refundAmountINR / 1.18).toFixed(2));
    const gstAmount = parseFloat((refundAmountINR - orderAmount).toFixed(2));

    // Create a new refund transaction
    const refundTransaction = new PaymentTransaction({
      userId: transaction.userId,
      subscriptionId: transaction.subscriptionId,
      type: 'refund',
      orderAmount: orderAmount,
      gstAmount: gstAmount,
      totalAmount: refundAmountINR,
      currency: refund.currency,
      gateway: 'razorpay',
      status: 'completed',
      gatewayData: {
        paymentId: refund.id,
        orderId: transaction.gatewayData.orderId
      },
      metadata: {
        originalTransactionId: transaction._id,
        planId: transaction.metadata.planId,
        planName: transaction.metadata.planName,
        refundReason: refund.notes?.reason || 'Customer requested',
        taxAmount: gstAmount
      }
    });

    await refundTransaction.save();

    // Update original transaction
    transaction.status = 'refunded';
    await transaction.save();

    // If there's an active subscription connected to this payment, cancel it
    if (transaction.subscriptionId) {
      const subscription = await UserSubscription.findById(transaction.subscriptionId);

      if (subscription && subscription.status === 'active') {
        subscription.status = 'cancelled';
        await subscription.save();

        // Remove verified badge from user
        await User.findByIdAndUpdate(subscription.userId, {
          $set: { verifiedBadge: false }
        });
      }
    }

    console.log(`Refund processed for payment ID: ${paymentId}`);
  } catch (error) {
    console.error('Error processing refund:', error);
  }
}

async function handleSubscriptionCharged(payload) {
  const subscription = payload.payload.subscription.entity;
  const payment = payload.payload.payment.entity;

  try {
    // Find the user subscription using Razorpay subscription ID
    const userSubscription = await UserSubscription.findOne({
      'autoRenewal.subscriptionId': subscription.id
    });

    if (!userSubscription) {
      console.error(`User subscription not found for Razorpay subscription ID: ${subscription.id}`);
      return;
    }

    // Inside handleSubscriptionCharged function
    const totalAmount = payment.amount / 100;
    const orderAmount = parseFloat((totalAmount / 1.18).toFixed(2));
    const gstAmount = parseFloat((totalAmount - orderAmount).toFixed(2));

    const transaction = new PaymentTransaction({
      userId: userSubscription.userId,
      type: 'subscription_renewal',
      orderAmount: orderAmount,
      gstAmount: gstAmount,
      totalAmount: totalAmount,
      currency: payment.currency,
      gateway: 'razorpay',
      status: 'completed',
      gatewayData: {
        paymentId: payment.id,
        method: payment.method,
        receiptId: `AUTORENEWAL_${userSubscription.userId}_${Date.now()}`
      },
      metadata: {
        planId: userSubscription.planId,
        planName: subscription.plan_id,
        subscriptionId: subscription.id,
        autoRenewal: true,
        originalAmount: plan.price.actual,
        discountAmount: plan.price.actual - plan.price.discounted,
        taxAmount: gstAmount
      }
    });

    await transaction.save();

    // Create a new subscription period
    const plan = await SubscriptionPlan.findById(userSubscription.planId);

    if (!plan) {
      console.error(`Plan not found for ID: ${userSubscription.planId}`);
      return;
    }

    // Mark current subscription as expired
    userSubscription.status = 'expired';
    await userSubscription.save();

    // Create new subscription period
    const startDate = new Date(userSubscription.endDate); // Start from end of previous period
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.durationInMonths);

    const newSubscription = new UserSubscription({
      userId: userSubscription.userId,
      planId: userSubscription.planId,
      status: 'active',
      startDate,
      endDate,
      features: {
        chat: {
          total: plan.features.chat.total,
          used: 0,
          isUnlimited: plan.features.chat.isUnlimited
        },
        contactViews: {
          total: plan.features.contactViews.total,
          used: 0
        },
        superInterest: {
          total: plan.features.superInterest.total,
          used: 0
        },
        profileVisibility: {
          multiplier: plan.features.profileVisibility.multiplier
        },
        verifiedBadge: {
          active: plan.features.verifiedBadge.included
        },
        rmManager: {
          active: plan.features.rmManager.included
        }
      },
      payment: {
        transactionId: transaction._id,
        amount: transaction.amount,
        currency: transaction.currency,
        method: payment.method,
        gateway: 'razorpay',
        gatewayPaymentId: payment.id,
        status: 'completed',
        receiptId: transaction.gatewayData.receiptId
      },
      autoRenewal: {
        enabled: true,
        subscriptionId: subscription.id
      },
      renewalHistory: [{
        previousSubscriptionId: userSubscription._id,
        renewedAt: new Date(),
        paymentId: payment.id
      }]
    });

    await newSubscription.save();

    // Update transaction with new subscription ID
    transaction.subscriptionId = newSubscription._id;
    await transaction.save();

    console.log(`Auto-renewal processed for user ${userSubscription.userId}, new subscription created`);
  } catch (error) {
    console.error('Error processing subscription charge:', error);
  }
}

async function handleSubscriptionCancelled(payload) {
  const subscription = payload.payload.subscription.entity;

  try {
    // Find the user subscription using Razorpay subscription ID
    const userSubscription = await UserSubscription.findOne({
      'autoRenewal.subscriptionId': subscription.id,
      status: 'active'
    });

    if (!userSubscription) {
      console.error(`Active user subscription not found for Razorpay subscription ID: ${subscription.id}`);
      return;
    }

    // Update subscription auto-renewal status
    userSubscription.autoRenewal.enabled = false;
    await userSubscription.save();

    console.log(`Auto-renewal cancelled for user ${userSubscription.userId}`);
  } catch (error) {
    console.error('Error processing subscription cancellation:', error);
  }
}



module.exports = subscriptionController
