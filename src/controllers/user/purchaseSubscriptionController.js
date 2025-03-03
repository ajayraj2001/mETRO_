// const Razorpay = require("razorpay");
// const { User, SubscriptionPlan, Transaction, Notification } = require("../../models");
// const asyncHandler = require("../../utils/asyncHandler");
// const { ApiError } = require("../../errorHandler");
// const moment = require('moment-timezone');
// const crypto = require("crypto");
// const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");

// const durationMapping = {
//   'monthly': 30,
//   'quarterly': 90,
//   'annual': 365
// };

// const createTransaction = asyncHandler(async (req, res, next) => {
//   const razorpayInstance = new Razorpay({
//     key_id: process.env.RAZOR_KEY_ID_TEST,
//     key_secret: process.env.RAZOR_KEY_SECRET_TEST,
//   });

//   const { planId, duration } = req.body;
//   const userId = req.user._id;

//   // Validate duration
//   if (!['monthly', 'quarterly', 'annual'].includes(duration)) {
//     return next(new ApiError('Invalid subscription duration', 400));
//   }

//   const subscriptionPlan = await SubscriptionPlan.findById(planId);
//   if (!subscriptionPlan) return next(new ApiError('Plan not found', 404));

//   const priceOption = subscriptionPlan.pricing[duration];
//   if (!priceOption) return next(new ApiError('Pricing option not found', 400));

//   const order = await razorpayInstance.orders.create({
//     amount: priceOption.discounted * 100,
//     currency: "INR",
//     receipt: `receipt_${Date.now()}`,
//   });

//   const transaction = new Transaction({
//     userId,
//     plan: planId,
//     duration,
//     price: priceOption.discounted,
//     orderId: order.id,
//     orderStatus: "initiated"
//   });

//   await transaction.save();

//   res.status(200).json({
//     success: true,
//     message: "Payment initiated",
//     order_id: order.id,
//     amount: priceOption.discounted,
//     currency: "INR"
//   });
// });

// const transactionWebhook = asyncHandler(async (req, res) => {
//   const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//   const signature = req.headers["x-razorpay-signature"];

//   const bodyString = JSON.stringify(req.body);
//   const generatedSignature = crypto.createHmac("sha256", secret).update(bodyString).digest("hex");

//   if (generatedSignature !== signature) {
//     return res.status(400).json({ status: "error", message: "Invalid signature" });
//   }

//   const event = req.body;
//   const payment = event.payload?.payment?.entity;
//   if (!payment) return res.status(400).json({ status: "error", message: "Invalid webhook data" });

//   try {
//     const transaction = await Transaction.findOne({ orderId: payment.order_id });
//     if (!transaction) return res.status(404).json({ status: "error", message: "Transaction not found" });

//     if (event.event === "payment.captured") {
//       const plan = await SubscriptionPlan.findById(transaction.plan);
//       const user = await User.findById(transaction.userId);

//       // Calculate subscription dates
//       const startDate = new Date();
//       const durationDays = durationMapping[transaction.duration];
//       const endDate = moment(startDate).add(durationDays, 'days').toDate();

//       // Update user subscription features
//       user.subscriptionExpiryDate = endDate;
//       user.subscriptionPlan = transaction.plan;
//       user.maxPhoneNumbersViewable = plan.features.contactViews.total;
//       user.rmAccess = plan.features.rmManager.included;
//       user.profileVisibility = plan.features.profileVisibility.type;

//       // Handle existing active subscription
//       if (user.subscriptionExpiryDate > new Date()) {
//         user.maxPhoneNumbersViewable += plan.features.contactViews.total;
//       }

//       // Create notification
//       const notification = new Notification({
//         user: user._id,
//         title: "Subscription Activated",
//         message: `${plan.planName} plan activated with ${plan.features.contactViews.total} contacts access`,
//         pic: user.profile_image[0] || ""
//       });

//       await Promise.all([
//         user.save(),
//         transaction.updateOne({
//           orderStatus: "success",
//           paymentId: payment.id,
//           startDate,
//           endDate,
//           status: "Active"
//         }),
//         notification.save(),
//         sendFirebaseNotification(
//           user.deviceToken,
//           "Subscription Activated",
//           `Your ${plan.planName} plan is now active!`
//         )
//       ]);

//       return res.status(200).json({ status: "ok" });
//     }
//     else if (event.event === "payment.failed") {
//       await transaction.updateOne({
//         orderStatus: "failed",
//         paymentId: payment.id,
//         status: "Expired"
//       });
//       return res.status(200).json({ status: "ok" });
//     }

//     return res.status(200).json({ status: "unhandled_event" });
//   } catch (error) {
//     console.error("Webhook processing error:", error);
//     return res.status(500).json({ status: "error", message: error.message });
//   }
// });

// // Add to user model:
// /*
// contactViewsRemaining: { type: Number, default: 0 },
// subscriptionPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
// rmAccess: { type: Boolean, default: false },
// profileVisibility: { type: String, enum: ['Standard', 'Enhanced', 'Premium', 'VIP'], default: 'Standard' }
// */

// module.exports = {
//   createTransaction,
//   transactionWebhook
// };


const Razorpay = require("razorpay");
const { User, SubscriptionPlan, Transaction, UserSubscription, Notification } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const moment = require('moment-timezone');
const crypto = require("crypto");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");

const razorpay = new Razorpay({
  key_id: process.env.RAZOR_KEY_ID_TEST,
  key_secret: process.env.RAZOR_KEY_SECRET_TEST
});

const durationMapping = {
  monthly: 30,
  quarterly: 90,
  annual: 365
};

const createTransaction = asyncHandler(async (req, res, next) => {
  const { planId, duration } = req.body;
  const user = req.user;

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) throw new ApiError('Plan not found', 404);

  // Validate duration
  if (!durationMapping[duration]) {
    return next(new ApiError('Invalid subscription duration', 400));
  }

  // Calculate amount and validity
  const amount = plan.pricing[duration].discounted * 100;
  const validityDays = durationMapping[duration];

  // Create Razorpay order
  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: `order_${Date.now()}`,
    notes: {
      userId: user._id.toString(),
      planId: planId.toString(),
      duration
    }
  });

  // Create transaction record
  const transaction = await Transaction.create({
    user: user._id,
    plan: planId,
    razorpayOrderId: order.id,
    amount: amount / 100,
    status: "created"
  });

  res.status(200).json({
    success: true,
    message: "Payment initiated",
    order_id: order.id,
    amount: order.amount,
    currency: "INR"
  });
});

const transactionWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  const body = req.body;
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(body));
  const digest = shasum.digest('hex');

  if (digest !== signature) {
    return res.status(400).json({ status: "error", message: "Invalid signature" });
  }

  const event = body.event;
  const payment = body.payload.payment.entity;

  try {
    // Find related transaction
    const transaction = await Transaction.findOne({
      razorpayOrderId: payment.order_id
    }).populate('plan');

    if (!transaction) {
      return res.status(404).json({ status: "error", message: "Transaction not found" });
    }

    if (event === "payment.captured") {
      // Update transaction
      transaction.status = "paid";
      transaction.razorpayPaymentId = payment.id;
      transaction.razorpaySignature = signature;
      transaction.paymentMethod = payment.method;
      await transaction.save();

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = moment(startDate).add(durationMapping[payment.notes.duration], 'days').toDate();

      // Create user subscription
      const userSubscription = await UserSubscription.create({
        user: transaction.user,
        plan: transaction.plan._id,
        transaction: transaction._id,
        startDate,
        endDate,
        billingCycle: payment.notes.duration,
        status: "active"
      });

      // Update user
      const user = await User.findById(transaction.user);
      user.subscription = userSubscription._id;
      user.verifiedBadge = transaction.plan.features.verifiedBadge.included;
      user.features = {
        contactViews: transaction.plan.features.contactViews.total,
        superInterests: transaction.plan.features.superInterest.total,
        profileVisibility: transaction.plan.features.profileVisibility.type,
        rmAccess: transaction.plan.features.rmManager.accessLevel !== 'None'
      };
      await user.save();

      // Send notification
      await Notification.create({
        user: user._id,
        title: "Subscription Activated",
        message: `${transaction.plan.planName} plan activated successfully`,
        type: "subscription"
      });

      sendFirebaseNotification(
        user.deviceToken,
        "Subscription Activated",
        `Your ${transaction.plan.planName} plan is now active!`
      )

      return res.status(200).json({ status: "success" });
    }
    else if (event === "payment.failed") {
      transaction.status = "failed";
      await transaction.save();
      return res.status(200).json({ status: "failed" });
    }

    res.status(200).json({ status: "unhandled_event" });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = {
  createTransaction,
  transactionWebhook
};