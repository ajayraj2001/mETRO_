const { SubscriptionPlan } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const getAllSubscriptionPlans = asyncHandler(async (req, res, next) => {
  const subscriptionPlans = await SubscriptionPlan.find();

  return res.status(200).json({
    success: true,
    message: subscriptionPlans.length
      ? "Subscription plans found successfully"
      : "No subscription plans available",
    data: subscriptionPlans,
  });
});

module.exports = { getAllSubscriptionPlans };
