const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { User } = require("../../models");

const getAllUsers = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const totalUsers = await User.countDocuments();

  const users = await User.find()
    .select('-location -otp -otp_expiry -created_at -updated_at')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ created_at: -1 });

  // Pagination meta data
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
