const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { SubscriptionPlan } = require("../../models");

const createSubscriptionPlan = asyncHandler(async (req, res, next) => {
    const { planName, price, maxPhoneNumbersViewable, durationInDays } = req.body;
  
    const subscriptionPlan = await SubscriptionPlan.create({
      planName,
      price,
      maxPhoneNumbersViewable,
      durationInDays,
    });
  
    return res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: subscriptionPlan,
    });
  }); 
  
  const getAllSubscriptionPlans = asyncHandler(async (req, res, next) => {
    const subscriptionPlans = await SubscriptionPlan.find();

    if (!subscriptionPlans) {
        return next(new ApiError('No Subscription plan not found', 404));
    }
  
    return res.status(200).json({
      success: true,
      message: 'Subscription plans found successfully',
      data: subscriptionPlans,
    });
  });
  
  const updateSubscriptionPlan = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const updates = req.body;
  
    const subscriptionPlan = await SubscriptionPlan.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: false,
    });
  
    if (!subscriptionPlan) {
      return next(new ApiError('Subscription plan not found', 404));
    }
  
    return res.status(200).json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: subscriptionPlan,
    });
  });
  
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
  };