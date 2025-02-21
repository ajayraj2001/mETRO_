const { User, Like, Notification } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");

const likeUserProfile = asyncHandler(async (req, res, next) => {
  const { id: userLikedTo } = req.params;
  const user = req.user._id;
  const { fullName, profile_image } = req.user;

  const likedUser = await User.findById(userLikedTo);

  // Create a new like
  const like = new Like({ user, userLikedTo });
  await like.save();

  await Notification.create({
    user : userLikedTo, 
    title : "Profile Liked",
    message: `${fullName} has liked your profile.`,
    pic: profile_image
  });

  await sendFirebaseNotification(likedUser.deviceToken, "Profile Liked", `${fullName} has liked your profile.`);

  return res.status(201).json({
    success: true,
    message: "User profile liked successfully.",
  });
});

// Get all users that a specific user has liked
const getLikedUsers = asyncHandler(async (req, res, next) => {
  const user = req.user._id;

  const likedUsers = await Like.find({ user }).populate(
    "userLikedTo",
    "fullName profile_image"
  );

  if (!likedUsers || likedUsers.length === 0) {
    return next(new ApiError("No liked users found for this user.", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Liked users fetched successfully.",
    data: likedUsers,
  });
});

// Unlike a user profile
const unlikeUserProfile = asyncHandler(async (req, res, next) => {
  const { id: userLikedTo } = req.params;
  const user = req.user._id;

  const like = await Like.findOneAndDelete({ user, userLikedTo });

  if (!like) return next(new ApiError("Like not found.", 404));

  return res.status(200).json({
    success: true,
    message: "User profile unliked successfully.",
  });
});

module.exports = {
  likeUserProfile,
  getLikedUsers,
  unlikeUserProfile,
};
