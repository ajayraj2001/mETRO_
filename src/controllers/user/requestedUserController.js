const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const { ApiError } = require("../../errorHandler");
const asyncHandler = require("../../utils/asyncHandler");
const User = require("../../models/user");
const RequestedUser = require("../../models/requestedUser");
const Notification = require("../../models/notification");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");

const sendOrUpdateRequest = asyncHandler(async (req, res, next) => {
  const { userRequestedTo, status } = req.body;
  const user = req.user._id;
  const {fullName, deviceToken, profile_image } = req.user;
  
  if (!userRequestedTo)
    return next(new ApiError("Requested user id is required", 400));

  // Check if the current user is the one making the request
  if (user.toString() === userRequestedTo.toString())
    return next(new ApiError("You cannot request yourself.", 403));

  // Find an existing document for the users
  const existingRequest = await RequestedUser.findOne({
    $or: [
      { user, userRequestedTo },
      { user: userRequestedTo, userRequestedTo: user },
    ],
  });

  const requestedUser = await User.findById(userRequestedTo);

  if (existingRequest) {
    if (!status) {
      return next(
        new ApiError(
          "Request already exists between these users. You cannot send a new one.",
          403
        )
      );
    }

    // If the document exists, update the status
    if (existingRequest.user.toString() === user.toString()) {
      return next(new ApiError("You cannot modify this request.", 403));
    }

    existingRequest.status = status;
    await existingRequest.save({ validateBeforeSave: false });

    if (existingRequest.status === "Accept") {

      await Notification.create({
        user: userRequestedTo,
        title: "Friend Request Accepted",
        message: `${fullName} has accepted your Friend Request.`,
        pic: profile_image
      });

      await sendFirebaseNotification(
        requestedUser.deviceToken,
        "Friend Request Accepted",
        `${fullName} has accepted your Friend Request.`
      );

    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully.",
    });
  } else {
    // If the document does not exist, create a new one
    const newRequest = new RequestedUser({ user, userRequestedTo });
    const newRequestPromise = newRequest.save();

    const notificationPromise = Notification.create({
      user: userRequestedTo,
      title: "Friend Request Received",
      message: `${fullName} has sent you a Friend Request.`,
      pic: profile_image
    });

    // Wait for both promises to resolve
    await Promise.all([newRequestPromise, notificationPromise]);

    await sendFirebaseNotification(
      requestedUser.deviceToken,
      "Friend Request Received",
      `${fullName} has sent you a Friend Request.`
    );

    return res.status(201).json({
      success: true,
      message: "Request sent successfully.",
    });
  }
});

const sentRequestTo = asyncHandler(async (req, res, next) => {
  const user = req.user._id;

  const requestedTo = await RequestedUser.find({ user, status : "Requested" })
    .sort({ createdAt: -1 })
    .populate({
      path: "userRequestedTo",
      select: "fullName height city profile_image",
    });

  // if (!requestedTo || requestedTo.length === 0)
  //   return next(new ApiError("You have not requested to anyone so far.", 404));

  return res.status(200).json({
    success: true,
    message: "Data fetched successfully.",
    data: requestedTo,
  });
});

const unsendRequest = asyncHandler(async (req, res, next) => {
  const user = req.user._id;
  const { id: userRequestedTo } = req.params;

  const unsend = await RequestedUser.findOneAndDelete({
    user,
    userRequestedTo,
  });

  if (!unsend) return next(new ApiError("Request not found.", 404));

  return res.status(200).json({
    success: true,
    message: "You have successfully retracked your request.",
  });
});

const gotRequestFrom = asyncHandler(async (req, res, next) => {
  const user = req.user._id;

  const requestedBy = await RequestedUser.find({
    userRequestedTo: user,
    status: "Requested",
  })
    .sort({ createdAt: -1 })
    .populate({
      path: "user",
      select: "fullName height city profile_image",
    });

  // if (!requestedBy || requestedBy.length === 0)
  //   return next(new ApiError("You have not got any request so far.", 404));

  return res.status(200).json({
    success: true,
    message: "Data fetched successfully.",
    data: requestedBy,
  });
});

const checkStatusForChatting = asyncHandler(async (req, res, next) => {
  const user = req.user._id;
  const otherUser = req.params.id;

  const data = await RequestedUser.findOne({
    $or: [
      { user: user, userRequestedTo: otherUser },
      { user: otherUser, userRequestedTo: user },
    ],
  });

  if (!data) return next(new ApiError("No request Found", 404));

  if (data.status !== "Accept") {
    if (user.toString() === data.userRequestedTo.toString())
      return next(new ApiError("You have not accepted the request.", 404));

    if (user.toString() === data.user.toString())
      return next(new ApiError("Your request has not been accepted.", 404));
  }

  if (!data) {
    return next(
      new ApiError("Neither you nor other user has sent friend request.", 404)
    );
  }

  return res.status(200).json({
    success: true,
    message: "You are eligible to chat with this user.",
  });
});

module.exports = {
  sendOrUpdateRequest,
  sentRequestTo,
  unsendRequest,
  gotRequestFrom,
  checkStatusForChatting,
};
