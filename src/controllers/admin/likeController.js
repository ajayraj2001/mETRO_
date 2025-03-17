// const { Like } = require("../../models");

// const getUserLikedByAdmin = asyncHandler(async (req, res, next) => {
//     const { user_id } = req.params; // Admin provides user ID
  
//     const likedUsers = await Like.find({ user: user_id }).populate(
//       "userLikedTo",
//       "fullName profile_image"
//     );
  
//     if (!likedUsers || likedUsers.length === 0) {
//       return next(new ApiError("No liked users found for this user.", 404));
//     }
  
//     return res.status(200).json({
//       success: true,
//       message: "Liked users fetched successfully.",
//       data: likedUsers,
//     });
//   });
  
  
//   module.exports = {getUserLikedByAdmin};
  