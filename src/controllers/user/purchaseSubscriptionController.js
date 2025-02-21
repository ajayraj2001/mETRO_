const Razorpay = require("razorpay");
const { User, SubscriptionPlan, Transaction, Notification } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const moment = require('moment-timezone');
const crypto = require("crypto");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");


const createTransaction = async (req, res, next) => {
  const razorpayInstance = new Razorpay({
    key_id: process.env.RAZOR_KEY_ID_TEST,
    key_secret: process.env.RAZOR_KEY_SECRET_TEST,
  });

  try {
    const { plan, price } = req.body;
    const userId = req.user._id;

    console.log("==========>>>>>", req.body)

    const order = await razorpayInstance.orders.create({
      amount: price * 100, // Amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    const data = new Transaction({
      userId,
      plan,
      price,
      orderId : order.id,
      orderStatus : "initiated"
    });

    await data.save();

    return res.status(200).json({
      status: true,
      message: "Payment initiated, order details",
      order_id: order.id,  // Razorpay order ID
    });

  } catch (error) {
    console.error("Error initiating payment:", error);
    next(error);
  }

}

// const transactionWebhook = async (req, res) => {

//   const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

//   try {

//     const bodyString = JSON.stringify(req.body);
//     console.log(bodyString, "body");

//     const shasum = crypto.createHmac("sha256", secret);
//     shasum.update(bodyString);
//     const digest = shasum.digest("hex");

//     if (digest === req.headers["x-razorpay-signature"]) {
//       const event = req.body;
//       console.log(event, "event+++++++++++++++++++++++++++");

//       const paymentEntity = event.payload.payment.entity;
//       console.log(paymentEntity.order_id, "order_id");

//       if (event.event === "payment.captured") {
//         console.log("Payment captured or authorized event received");

//         const orderId = paymentEntity.order_id;

//         if (!orderId) {
//           console.error("Order ID is null. Cannot proceed.");
//           return res.status(400).json({ status: "error", message: "Order ID is null" });
//         }

//         const transactionObj = await Transaction.findOne({ orderId });

//         const subscriptionPlanPromise = SubscriptionPlan.findById(transactionObj.plan);
//         const userPromise = User.findById(transactionObj.userId);

//         const [subscriptionPlan, user] = await Promise.all([subscriptionPlanPromise, userPromise]);

//         // Set IST timezone
//         const currentDate = moment().tz("Asia/Kolkata").toDate(); // current time in IST
//         let startDate = moment().tz("Asia/Kolkata").startOf('day').toDate(); // current day start time in IST
//         let endDate = moment(startDate).add(parseInt(subscriptionPlan.durationInDays), 'days').endOf('day').toDate(); // calculate end date for new plan

//         const previousExpiryDate = moment(user.subscriptionExpiryDate).tz("Asia/Kolkata");

//         if (previousExpiryDate && previousExpiryDate.isAfter(currentDate)) {
//           startDate = previousExpiryDate.add(1, 'days').startOf('day').toDate();  // Start the new plan after the previous plan ends
//           endDate = moment(startDate).add(parseInt(subscriptionPlan.durationInDays), 'days').endOf('day').toDate();  // Update end date
//         } 

//         // Adjust the user's subscription details accordingly
//         if (user.subscriptionExpiryDate && moment(user.subscriptionExpiryDate).isAfter(currentDate)) {
//           user.maxPhoneNumbersViewable += +subscriptionPlan.maxPhoneNumbersViewable;
//           user.subscriptionExpiryDate = moment(user.subscriptionExpiryDate).add(parseInt(subscriptionPlan.durationInDays) + 1, 'days').endOf('day').toDate();
//         } else {
//           user.maxPhoneNumbersViewable = +subscriptionPlan.maxPhoneNumbersViewable;
//           user.subscriptionExpiryDate = endDate;
//         }

//         const savePromise = user.save();

//         const updatePromise = Transaction.findOneAndUpdate(
//           { orderId },
//           { orderStatus: "success", paymentId: paymentEntity.id, startDate, endDate },
//           { new: true }
//         );

//         const notificationPromise = Notification.create({
//           user : user._id,
//           title : "Subscription Purchase",
//           message : `You have successfully purchase our ${subscriptionPlan.planName} of worth ₹ ${subscriptionPlan.price}.`,
//           pic : user.profile_image
//         });

//         await Promise.all([savePromise, updatePromise, notificationPromise]);

//         await sendFirebaseNotification(
//           user.deviceToken, 
//           "Subscription Purchase",  
//           `You have successfully purchase our ${subscriptionPlan.planName} plan of worth ₹ ${subscriptionPlan.price}.`
//         );

//         console.log("===================>>>>>>>>>>>>>", user.deviceToken)

//       } else if (event.event === "payment.failed") {
//         const orderId = paymentEntity.order_id;
//         if (!orderId) {
//           console.error("Order ID is null. Cannot proceed.");
//           return res
//             .status(400)
//             .json({ status: "error", message: "Order ID is null" });
//         }

//         await Transaction.findOneAndUpdate(
//           { orderId },
//           { orderStatus: "failed", paymentId: paymentEntity.id },
//           { new: true }
//         );
//       }

//       res.status(200).json({ status: "ok" });

//     } else {
//       res.status(400).json({ status: "invalid signature" });
//     }

//   } catch (error) {
//     console.error("Error processing webhook:", error);
//     res.status(500).json({ status: "error", message: error.message });
//   }

// }


const transactionWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  try {
    const bodyString = JSON.stringify(req.body);

    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(bodyString);
    const digest = shasum.digest("hex");

    if (digest === req.headers["x-razorpay-signature"]) {
      const event = req.body;

      const paymentEntity = event.payload.payment.entity;

      if (event.event === "payment.captured") {
        const orderId = paymentEntity.order_id;

        if (!orderId) {
          return res.status(400).json({ status: "error", message: "Order ID is null" });
        }

        const transactionObj = await Transaction.findOne({ orderId });
        const subscriptionPlan = await SubscriptionPlan.findById(transactionObj.plan);
        const user = await User.findById(transactionObj.userId);

        const currentDate = moment().tz("Asia/Kolkata").toDate(); // Current IST time
        const planDurationDays = parseInt(subscriptionPlan.durationInDays, 10);
        let startDate, endDate;

        if (user.subscriptionExpiryDate && moment(user.subscriptionExpiryDate).isAfter(currentDate)) {
          // Active plan case: Start after the current plan's expiry
          startDate = moment(user.subscriptionExpiryDate).add(1, "days").startOf("day").toDate();
          endDate = moment(startDate).add(planDurationDays, "days").endOf("day").toDate();
          user.maxPhoneNumbersViewable += parseInt(subscriptionPlan.maxPhoneNumbersViewable, 10);
        } else {
          // Expired or no plan case: Start immediately
          startDate = moment().tz("Asia/Kolkata").startOf("day").toDate();
          endDate = moment(startDate).add(planDurationDays, "days").endOf("day").toDate();
          user.maxPhoneNumbersViewable = parseInt(subscriptionPlan.maxPhoneNumbersViewable, 10);
        }

        // Update user's subscription details
        user.subscriptionExpiryDate = endDate;

        const saveUserPromise = user.save();
        const updateTransactionPromise = Transaction.findOneAndUpdate(
          { orderId },
          { orderStatus: "success", paymentId: paymentEntity.id, startDate, endDate },
          { new: true }
        );
        const notificationPromise = Notification.create({
          user: user._id,
          title: "Subscription Purchase",
          message: `You have successfully purchased our ${subscriptionPlan.planName} plan worth ₹${subscriptionPlan.price}.`,
          pic: user.profile_image,
        });

        // Send Firebase notification
        const firebaseNotificationPromise = sendFirebaseNotification(
          user.deviceToken,
          "Subscription Purchase",
          `You have successfully purchased our ${subscriptionPlan.planName} plan worth ₹${subscriptionPlan.price}.`
        );

        await Promise.all([saveUserPromise, updateTransactionPromise, notificationPromise, firebaseNotificationPromise]);

        return res.status(200).json({ status: "ok" });
      } else if (event.event === "payment.failed") {
        const orderId = paymentEntity.order_id;

        if (!orderId) {
          return res.status(400).json({ status: "error", message: "Order ID is null" });
        }

        await Transaction.findOneAndUpdate(
          { orderId },
          { orderStatus: "failed", paymentId: paymentEntity.id },
          { new: true }
        );

        return res.status(200).json({ status: "ok" });
      }

      return res.status(200).json({ status: "unknown event" });
    } else {
      return res.status(400).json({ status: "invalid signature" });
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};


module.exports = {
  createTransaction,
  transactionWebhook
};
