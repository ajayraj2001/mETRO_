const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;

const { Support } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const createQuery = asyncHandler(async (req, res, next) => {
  const userId = req.user?._id;
  if (!isValidObjectId(userId)) return next(new ApiError("Invalid User", 400));

  const query = req.body.query;

  await Support.create({ user : userId, query, answer: "" });

  res.status(200).json({
    success: true,
    message: "Your Query has been submitted successfully",
  });
});

const getQueryData = asyncHandler(async (req, res, next) => {
  const userId = req.user?._id;
  if (!isValidObjectId(userId)) return next(new ApiError("Invalid User", 400));

  const data = await Support.find({ user : userId });

  if (!data)
    return next(new ApiError("You have not submitted any query yet.", 404));

  res.status(200).json({
    success: true,
    message: "Query fetched successfully",
    data
  });
});

module.exports = {
  createQuery,
  getQueryData,
};
