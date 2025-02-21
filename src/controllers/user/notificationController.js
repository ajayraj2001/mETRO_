const { User, Like, Notification } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const getNotification = asyncHandler(async (req, res, next) => {
  const user = req.user._id;

  const data = await Notification.find({ user }).sort({ createdAt: -1 });

  if (!data) return next(new ApiError("No Notification found.", 404));

  return res.status(200).json({
    success: true,
    message: "Notification data fetched successfully.",
    data,
  });
});


const deleteNotification = asyncHandler(async (req, res, next) => {

  const user = req.user._id;

  const data = await Notification.deleteMany({ user });

  if(data.deletedCount === 0) return next(new ApiError("No notification found.", 400));

  return res.status(200).json({
    success: true,
    message: "Notification deleted successfully."
  });

});

module.exports = {
  getNotification,
  deleteNotification
};
