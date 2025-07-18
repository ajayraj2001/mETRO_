const { User, Like, Notification } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");

const likeUserProfile = asyncHandler(async (req, res, next) => {
  const { id: userLikedTo } = req.params;
  console.log('req.params', req.params)
  const user = req.user._id;
  const { fullName, profile_image } = req.user;

  try {
    const alreadyLiked = await Like.findOne({ user, userLikedTo });
    if (alreadyLiked) {
      return res.status(200).json({
        success: true,
        message: "You have already liked this profile.",
      });
    }

    await Like.create({ user, userLikedTo });
    await User.findByIdAndUpdate(userLikedTo, { $inc: { likeCount: 1 } });

    const likedUser = await User.findById(userLikedTo).select('deviceToken');

    await Notification.create({
      user: userLikedTo,
      title: "Profile Liked",
      message: `${fullName} has liked your profile.`,
      // pic: profile_image[0],
      pic: '',
      type: 'like',
      referenceId: user
    });

    // Send push notification only if token exists
    if (likedUser?.deviceToken) {
      await sendFirebaseNotification(
        likedUser.deviceToken,
        "Profile Liked",
        `${fullName} has liked your profile.`,
        user,
        type,
        profile_image[0]
      );
    }

    return res.status(201).json({
      success: true,
      message: "User profile liked successfully.",
    });
  } catch (err) {
    console.log('erre', err)
    if (err.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "You have already liked this profile.",
      });
    }
    return next(err);
  }
});


// const likeUserProfile = asyncHandler(async (req, res, next) => {
//   const { id: userLikedTo } = req.params;
//   const user = req.user._id;
//   const { fullName, profile_image } = req.user;

//   try {
//     // Check for existing like to prevent duplicates manually
//     const alreadyLiked = await Like.findOne({ user, userLikedTo });
//     if (alreadyLiked) {
//       return res.status(200).json({
//         success: true,
//         message: "You have already liked this profile.",
//       });
//     }
//     await Like.create({ user, userLikedTo });

//     // Increment like count on the liked user
//     await User.findByIdAndUpdate(userLikedTo, { $inc: { likeCount: 1 } });

//     await Notification.create({
//       user: userLikedTo,
//       title: "Profile Liked",
//       message: `${fullName} has liked your profile.`,
//       pic: profile_image
//     });

//     // await sendFirebaseNotification(likedUser.deviceToken, "Profile Liked", `${fullName} has liked your profile.`);

//     return res.status(201).json({
//       success: true,
//       message: "User profile liked successfully.",
//     });
//   } catch (err) {
//     if (err.code === 11000) {
//       // Duplicate key error (user already liked this profile)
//       return res.status(200).json({
//         success: true,
//         message: "You have already liked this profile.",
//       });
//     }
//     return next(err); // Forward any other errors
//   }
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
        user: 1,
        userLikedTo: {
          _id: 1,
          fullName: 1,
          profile_image: 1,
          profileId: 1
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

const unlikeUserProfile = asyncHandler(async (req, res, next) => {
  try {
    const { id: userLikedTo } = req.params;
    const user = req.user._id;

    const like = await Like.findOneAndDelete({ user, userLikedTo });

    if (!like) {
      return next(new ApiError("Like not found.", 404));
    }

    // Decrement likeCount safely (only if > 0)
    await User.findByIdAndUpdate(userLikedTo, {
      $inc: { likeCount: -1 }
    });

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
