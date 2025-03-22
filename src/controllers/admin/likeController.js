const { Like } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");

const getUserLikedByAdmin = asyncHandler(async (req, res, next) => {
  const { user_id } = req.params; // Admin provides user ID
  const { page = 1, limit = 10 } = req.query; // Default page: 1, limit: 10

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const likedUsers = await Like.find({ user: user_id })
    .sort({ _id: -1 })
    .populate("userLikedTo", "fullName profile_image phone")
    .skip(skip)
    .limit(parseInt(limit));

  const totalLikes = await Like.countDocuments({ user: user_id });

  return res.status(200).json({
    success: true,
    message: likedUsers.length > 0 ? "Liked users fetched successfully." : "No liked users found.",
    data: likedUsers || [],
    pagination: {
      total: totalLikes,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalLikes / parseInt(limit)),
    },
  });
});

module.exports = { getUserLikedByAdmin };
