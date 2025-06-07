const { User, Like, Notification } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const getNotification = asyncHandler(async (req, res, next) => {
  const user = req.user._id;

  // Pagination inputs from query params
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Fetch total count for frontend pagination
  const totalCount = await Notification.countDocuments({ user });

  // Fetch paginated notifications
  const data = await Notification.find({ user })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // if (!data || data.length === 0) {
  //   return next(new ApiError("No Notification found.", 404));
  // }

  if (!data || data.length === 0) {
  // Return empty success response instead of error
  return res.status(200).json({
    success: true,
    message: "No notifications found.",
    data: [],
    pagination: {
      total: 0,
      page,
      limit,
      totalPages: 0,
    },
  });
}

  // Mark all unread notifications as read (only for this user)
  await Notification.updateMany(
    { user, isRead: false },
    { $set: { isRead: true } }
  );

  return res.status(200).json({
    success: true,
    message: "Notification data fetched successfully.",
    data,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
});


const deleteNotification = asyncHandler(async (req, res, next) => {

  const user = req.user._id;

  const data = await Notification.deleteMany({ user });

  if (data.deletedCount === 0) return next(new ApiError("No notification found.", 400));

  return res.status(200).json({
    success: true,
    message: "Notification deleted successfully."
  });

});

module.exports = {
  getNotification,
  deleteNotification
};
