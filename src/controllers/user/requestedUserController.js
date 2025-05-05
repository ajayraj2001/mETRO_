const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const { ApiError } = require("../../errorHandler");
const asyncHandler = require("../../utils/asyncHandler");
const User = require("../../models/user");
const RequestedUser = require("../../models/requestedUser");
const Notification = require("../../models/notification");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");


const send_Or_UpdateRequest = asyncHandler(async (req, res, next) => {
  const { userRequestedTo, status } = req.body;
  const user = req.user._id;
  const {fullName, profile_image } = req.user;

  
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
 console.log('fhgfhgfjgfjf',existingRequest, 'req.odu', req.body)
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

    // existingRequest.status = status;
    // await existingRequest.save({ validateBeforeSave: false });

    // if (existingRequest.status === "Accept") {

    //   await Notification.create({
    //     user: userRequestedTo,
    //     title: "Friend Request Accepted",
    //     message: `${fullName} has accepted your Friend Request.`,
    //     pic: profile_image
    //   });

    //   await sendFirebaseNotification(
    //     requestedUser.deviceToken,
    //     "Friend Request Accepted",
    //     `${fullName} has accepted your Friend Request.`
    //   );

    // }

    if (status === "Ignore") {
      await RequestedUser.findByIdAndDelete(existingRequest._id);
    } else {
      existingRequest.status = status;
      await existingRequest.save({ validateBeforeSave: false });
    
      if (status === "Accept") {
        await Notification.create({
          user: userRequestedTo,
          title: "Friend Request Accepted",
          message: `${fullName} has accepted your Friend Request.`,
          pic: profile_image,
        });
    
        await sendFirebaseNotification(
          requestedUser.deviceToken,
          "Friend Request Accepted",
          `${fullName} has accepted your Friend Request.`
        );
      }
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

const sent_Request_To = asyncHandler(async (req, res, next) => {
  const user = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  const [requestedTo, total] = await Promise.all([
    RequestedUser.find({ user, status: "Requested" })
      .sort({ createdAt: -1 })  // Newest first
      .populate({
        path: "userRequestedTo",
        select: "fullName height city profile_image",
      })
      .skip(skip)
      .limit(limit),
      
    RequestedUser.countDocuments({ user, status: "Requested" })
  ]);

  return res.status(200).json({
    success: true,
    message: "Data fetched successfully.",
    data: requestedTo,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    },
  });
});

const got_Request_From = asyncHandler(async (req, res, next) => {
  const user = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  const [requestedBy, total] = await Promise.all([
    RequestedUser.find({ userRequestedTo: user, status: "Requested" })
      .sort({ createdAt: -1 }) // Newest first
      .populate({
        path: "user",
        select: "fullName height city profile_image",
      })
      .skip(skip)
      .limit(limit),

    RequestedUser.countDocuments({ userRequestedTo: user, status: "Requested" }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Data fetched successfully.",
    data: requestedBy,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    },
  });
});


const unsend_Request = asyncHandler(async (req, res, next) => {
  const user = req.user._id;
  const { id: userRequestedTo } = req.params;

  console.log('user', req.params, 'userid', user)
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

//main
const get_Follow_Data = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { type = "", page = 1, limit = 10 } = req.query;

  console.log('userId', req.query)
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  let query = {};
  let populateOptions = {};
  let modelField = "";

  switch (type) {
    case "followers":
      query = { userRequestedTo: userId, status: "Accept" };
      populateOptions = { path: "user", select: "fullName height city profile_image" };
      modelField = "user";
      break;

    case "following":
      query = { user: userId, status: "Accept" };
      populateOptions = { path: "userRequestedTo", select: "fullName dob state profile_image" };
      modelField = "userRequestedTo";
      break;

    case "requestedTo":
      query = { user: userId, status: "Requested" };
      populateOptions = { path: "userRequestedTo", select: "fullName dob state profile_image" };
      modelField = "userRequestedTo";
      break;

    case "requestedFrom":
      query = { userRequestedTo: userId, status: "Requested" };
      populateOptions = { path: "user", select: "fullName dob state profile_image" };
      modelField = "user";
      break;

    default:
      return res.status(400).json({
        success: false,
        message: "Invalid 'type' parameter. Use: followers, following, requestedTo, or requestedFrom.",
      });
  }

  console.log('query',query)
  const [records, total] = await Promise.all([
    RequestedUser.find(query)
      .sort({ createdAt: -1 })
      .populate(populateOptions)
      .skip(skip)
      .limit(limitNum),
    RequestedUser.countDocuments(query),
  ]);

  return res.status(200).json({
    success: true,
    message: `${type} data fetched successfully.`,
    data: records,
    pagination: {
      totalRecords: total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      perPage: limitNum,
    },
  });
});


const check_Status_For_Chatting = asyncHandler(async (req, res, next) => {
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
  get_Follow_Data, send_Or_UpdateRequest, sent_Request_To, unsend_Request, got_Request_From, check_Status_For_Chatting
};
