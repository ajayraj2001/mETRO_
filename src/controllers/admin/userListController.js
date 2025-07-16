const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { User } = require("../../models");

const getAllUsers = asyncHandler(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    // Build the search query
    const searchQuery = {
      $or: [
        { fullName: { $regex: search, $options: 'i' } }, // Case-insensitive search by name
        { phone: { $regex: search, $options: 'i' } }, // Case-insensitive search by number
      ],
    };

    // Add date filter if provided
    if (startDate && endDate) {
      searchQuery.$and = searchQuery.$and || []; // Ensure $and array exists before using push
      searchQuery.$and.push({
        created_at: {
          $gte: startDate || new Date(0),
          $lte: endDate ? new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)) : new Date(),
        },
      });
    }

    const totalUsers = await User.countDocuments(searchQuery);

    const users = await User.find(searchQuery)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-location -otp -otp_expiry -updated_at');

    // Pagination metadata
    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    };

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      pagination,
    });
  } catch (error) {
    console.log('error', error);
    next(error);
  }
});

const deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  return res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

module.exports = {
  getAllUsers,
  deleteUser
};
