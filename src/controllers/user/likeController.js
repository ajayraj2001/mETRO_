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
  console.log('get liked user api ', like)

  await Notification.create({
    user : userLikedTo, 
    title : "Profile Liked",
    message: `${fullName} has liked your profile.`,
    pic: profile_image
  });

  // await sendFirebaseNotification(likedUser.deviceToken, "Profile Liked", `${fullName} has liked your profile.`);

  return res.status(201).json({
    success: true,
    message: "User profile liked successfully.",
  });
});

// Get all users that a specific user has liked
const getLikedUsers = asyncHandler(async (req, res, next) => {
  console.log('get like user APi')
  const user = req.user._id;
  console.log('get like user APi---------user', user)

  const likedUsers = await Like.find({ user })
  .sort({ _id: -1 }) // Sort by newest first using indexed _id field
  .populate("userLikedTo", "fullName profile_image");


  if (!likedUsers || likedUsers.length === 0) {
    return next(new ApiError("No liked users found for this user.", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Liked users fetched successfully.",
    data: likedUsers,
  });
});

// const getLikedUsers = asyncHandler(async (req, res, next) => {
//   const user = req.user._id;
//   const page = Math.max(1, Number(req.query.page) || 1); // Default to page 1
//   const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10)); // Default limit 10, max 50
//   const skip = (page - 1) * limit;

//   const likedUsers = await Like.find({ user })
//     .sort({ _id: -1 }) // Sort by newest first using indexed _id field
//     .skip(skip)
//     .limit(limit)
//     .populate("userLikedTo", "fullName profile_image");

//   const totalLikedUsers = await Like.countDocuments({ user });

//   if (!likedUsers || likedUsers.length === 0) {
//     return next(new ApiError("No liked users found for this user.", 404));
//   }

//   return res.status(200).json({
//     success: true,
//     message: "Liked users fetched successfully.",
//     data: likedUsers,
//     pagination: {
//       currentPage: page,
//       pageSize: limit,
//       totalUsers: totalLikedUsers,
//       totalPages: Math.ceil(totalLikedUsers / limit),
//     },
//   });
// });


// Unlike a user profile
// const unlikeUserProfile = asyncHandler(async (req, res, next) => {
//   const { id: userLikedTo } = req.params;
//   const user = req.user._id;
  

//   const like = await Like.findOneAndDelete({ user, userLikedTo });

//   if (!like) return next(new ApiError("Like not found.", 404));

//   return res.status(200).json({
//     success: true,
//     message: "User profile unliked successfully.",
//   });
// });

const unlikeUserProfile = asyncHandler(async (req, res, next) => {
  try {
    const { id: userLikedTo } = req.params;
    const user = req.user._id;

    const like = await Like.findOneAndDelete({ user, userLikedTo });

    if (!like) {
      return next(new ApiError("Like not found.", 404));
    }

    return res.status(200).json({
      success: true,
      message: "User profile unliked successfully.",
    });
  } catch (error) {
    console.error("Error in unlikeUserProfile:", error); // Logs error to console
    next(error); // Pass the error to the error-handling middleware
  }
});


module.exports = {
  likeUserProfile,
  getLikedUsers,
  unlikeUserProfile,
};
