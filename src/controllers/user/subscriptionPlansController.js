const { SubscriptionPlan } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const getAllSubscriptionPlans = asyncHandler(async (req, res, next) => {
  const subscriptionPlans = await SubscriptionPlan.find();

  if (!subscriptionPlans)
    return next(new ApiError("No Subscription plan found", 404));

  return res.status(200).json({
    success: true,
    message: "Subscription plans found successfully",
    data: subscriptionPlans,
  });
});

module.exports = { getAllSubscriptionPlans };
