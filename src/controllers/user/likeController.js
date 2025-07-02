const { User, Like, Notification } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");

// const likeUserProfile = asyncHandler(async (req, res, next) => {
//   const { id: userLikedTo } = req.params;
//   const user = req.user._id;
//   const { fullName, profile_image } = req.user;

//   // const likedUser = await User.findById(userLikedTo);

//   // Create a new like
//   const like = new Like({ user, userLikedTo });
//   await like.save();

//   await Notification.create({
//     user: userLikedTo,
//     title: "Profile Liked",
//     message: `${fullName} has liked your profile.`,
//     pic: profile_image
//   });

//   // await sendFirebaseNotification(likedUser.deviceToken, "Profile Liked", `${fullName} has liked your profile.`);

//   return res.status(201).json({
//     success: true,
//     message: "User profile liked successfully.",
//   });
// });

const likeUserProfile = asyncHandler(async (req, res, next) => {
  const { id: userLikedTo } = req.params;
  const user = req.user._id;
  const { fullName, profile_image } = req.user;

  try {
    await Like.create({ user, userLikedTo });

    await Notification.create({
      user: userLikedTo,
      title: "Profile Liked",
      message: `${fullName} has liked your profile.`,
      pic: profile_image
    });

    // await sendFirebaseNotification(likedUser.deviceToken, "Profile Liked", `${fullName} has liked your profile.`);

    return res.status(201).json({
      success: true,
      message: "User profile liked successfully.",
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error (user already liked this profile)
      return res.status(200).json({
        success: true,
        message: "You have already liked this profile.",
      });
    }
    return next(err); // Forward any other errors
  }
});


// Get all users that a specific user has liked
// const getLikedUsers = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;
//   const { page = 1, limit = 20 } = req.query;

//   const pageNum = parseInt(page);
//   const limitNum = parseInt(limit);
//   const skip = (pageNum - 1) * limitNum;

//   const [likedUsers, totalCount] = await Promise.all([
//     Like.find({ user: userId })
//       .sort({ createdAt: -1 }) // latest first
//       .skip(skip)
//       .limit(limitNum)
//       .populate("userLikedTo", "fullName profile_image"),

//     Like.countDocuments({ user: userId })
//   ]);

//   if (!likedUsers || likedUsers.length === 0) {
//     return next(new ApiError("No liked users found for this user.", 404));
//   }

//   return res.status(200).json({
//     success: true,
//     message: "Liked users fetched successfully.",
//     data: likedUsers,
//     pagination: {
//       total: totalCount,
//       currentPage: pageNum,
//       totalPages: Math.ceil(totalCount / limitNum),
//       perPage: limitNum,
//     },
//   });
// });

const getLikedUsers = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, search = "" } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const matchStage = {
    user: userId
  };

  const aggregatePipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "users",
        localField: "userLikedTo",
        foreignField: "_id",
        as: "userLikedTo"
      }
    },
    { $unwind: "$userLikedTo" },
  ];

  // Apply search on fullName (case-insensitive)
  if (search.trim()) {
    aggregatePipeline.push({
      $match: {
        "userLikedTo.fullName": {
          $regex: search.trim(),
          $options: "i"
        }
      }
    });
  }

  // Count total documents with search filter
  const countPipeline = [...aggregatePipeline, { $count: "total" }];
  const countResult = await Like.aggregate(countPipeline);
  const totalCount = countResult[0]?.total || 0;

  // Apply pagination and sorting
  aggregatePipeline.push(
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limitNum },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        user:1,
        userLikedTo: {
          _id: 1,
          fullName: 1,
          profile_image: 1,
        }
      }
    }
  );

  const likedUsers = await Like.aggregate(aggregatePipeline);

  if (!likedUsers || likedUsers.length === 0) {
    return next(new ApiError("No liked users found for this user.", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Liked users fetched successfully.",
    data: likedUsers,
    pagination: {
      total: totalCount,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      perPage: limitNum,
    },
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
