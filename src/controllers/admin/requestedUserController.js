const mongoose = require("mongoose");
const asyncHandler = require("../../utils/asyncHandler");
const RequestedUser = require("../../models/requestedUser");

const sentRequestTo = asyncHandler(async (req, res, next) => {
    const {user} = req.params;

    const requestedTo = await RequestedUser.find({ user, status: "Requested" })
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

const gotRequestFrom = asyncHandler(async (req, res, next) => {
  const {user} = req.params;

  const requestedBy = await RequestedUser.find({
    userRequestedTo: user,
    status: "Requested",
  })
    .sort({ createdAt: -1 })
    .populate({
      path: "user",
      select: "fullName height city profile_image",
    });

  return res.status(200).json({
    success: true,
    message: "Data fetched successfully.",
    data: requestedBy,
  });
});

module.exports = { sentRequestTo, gotRequestFrom }