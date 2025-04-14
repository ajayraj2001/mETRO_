const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const SubscriptionPlan = require("../../models/subscriptionPlan");

// Create a new subscription plan
const createSubscriptionPlan = asyncHandler(async (req, res, next) => {
  const { planName, durationInMonths, price, features, displayOrder, isPopular, active } = req.body;

  // Validate required fields
  if (!durationInMonths || !price?.actual || !price?.discounted) {
    return next(new ApiError('Duration and pricing details are required', 400));
  }

  const subscriptionPlan = await SubscriptionPlan.create({
    planName,
    durationInMonths,
    price,
    features,
    displayOrder,
    isPopular,
    active
  });

  return res.status(201).json({
    success: true,
    message: 'Subscription plan created successfully',
    data: subscriptionPlan,
  });
});

// Get all subscription plans
const getAllSubscriptionPlans = asyncHandler(async (req, res, next) => {
  const subscriptionPlans = await SubscriptionPlan.find().sort({ displayOrder: 1 });

  if (!subscriptionPlans.length) {
    return next(new ApiError('No subscription plans found', 404));
  }

  return res.status(200).json({
    success: true,
    message: 'Subscription plans retrieved successfully',
    count: subscriptionPlans.length,
    data: subscriptionPlans,
  });
});

// Update a subscription plan
const updateSubscriptionPlan = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

  // Prevent changing planName after creation
  if (updates.planName) {
    return next(new ApiError('Plan name cannot be modified', 400));
  }

  const subscriptionPlan = await SubscriptionPlan.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!subscriptionPlan) {
    return next(new ApiError('Subscription plan not found', 404));
  }

  return res.status(200).json({
    success: true,
    message: 'Subscription plan updated successfully',
    data: subscriptionPlan,
  });
});

// Toggle active/inactive status of a subscription plan
const togglePlanStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const subscriptionPlan = await SubscriptionPlan.findById(id);
  if (!subscriptionPlan) {
    return next(new ApiError('Subscription plan not found', 404));
  }

  subscriptionPlan.active = !subscriptionPlan.active;
  await subscriptionPlan.save();

  return res.status(200).json({
    success: true,
    message: `Plan ${subscriptionPlan.active ? 'activated' : 'deactivated'} successfully`,
    data: subscriptionPlan
  });
});

// Delete a subscription plan
const deleteSubscriptionPlan = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const subscriptionPlan = await SubscriptionPlan.findByIdAndDelete(id);
  if (!subscriptionPlan) {
    return next(new ApiError('Subscription plan not found', 404));
  }

  return res.status(200).json({
    success: true,
    message: 'Subscription plan deleted successfully',
  });
});

module.exports = {
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  togglePlanStatus
};
