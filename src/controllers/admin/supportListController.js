const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { Support } = require("../../models");


const getAllSupportQueries = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const totalSupportQueries = await Support.countDocuments();

  const supportQueries = await Support.find()
    .populate('user', 'fullName phone')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  // Pagination meta data
  const pagination = {
    currentPage: page,
    totalPages: Math.ceil(totalSupportQueries / limit),
    totalSupportQueries,
  };

  return res.status(200).json({
    success: true,
    message: "Support queries fetched successfully",
    data: supportQueries,
    pagination,
  });
});


const updateSupportQuery = asyncHandler(async (req, res, next) => {
  const { id } = req.params;  // 
  const { answer } = req.body;

  const updatedSupportQuery = await Support.findByIdAndUpdate(
    id,
    { answer },
    { new: true, runValidators: false }
  ).populate('user', 'fullName phone');

  if (!updatedSupportQuery) {
    return next(new ApiError('Support query not found', 404));
  }

  return res.status(200).json({
    success: true,
    message: "Support query updated successfully",
    data: updatedSupportQuery,
  });
});


const deleteSupportQuery = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const supportQuery = await Support.findByIdAndDelete(id);

  if (!supportQuery) {
    return next(new ApiError('Support query not found', 404));
  }

  return res.status(200).json({
    success: true,
    message: "Support query deleted successfully",
  });
});

module.exports = {
  getAllSupportQueries,
  updateSupportQuery,
  deleteSupportQuery,
};
