// const mongoose = require("mongoose");
// const asyncHandler = require("../../utils/asyncHandler");
// const RequestedUser = require("../../models/requestedUser");

// const sentRequestTo = asyncHandler(async (req, res, next) => {
//   const { user } = req.params;
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;
//   const skip = (page - 1) * limit;

//   const totalRequests = await RequestedUser.countDocuments({ user, status: "Requested" });
//   const requestedTo = await RequestedUser.find({ user, status: "Requested" })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .populate({
//           path: "userRequestedTo",
//           select: "fullName height city profile_image",
//       });

//   return res.status(200).json({
//       success: true,
//       message: "Data fetched successfully.",
//       data: requestedTo,
//       pagination: {
//           total: totalRequests,
//           page,
//           limit,
//           totalPages: Math.ceil(totalRequests / limit),
//       },
//   });
// });

// const gotRequestFrom = asyncHandler(async (req, res, next) => {
//   const { user } = req.params;
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;
//   const skip = (page - 1) * limit;

//   const totalRequests = await RequestedUser.countDocuments({ userRequestedTo: user, status: "Requested" });
//   const requestedBy = await RequestedUser.find({ userRequestedTo: user, status: "Requested" })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .populate({
//           path: "user",
//           select: "fullName height city profile_image",
//       });

//   return res.status(200).json({
//       success: true,
//       message: "Data fetched successfully.",
//       data: requestedBy,
//       pagination: {
//           total: totalRequests,
//           page,
//           limit,
//           totalPages: Math.ceil(totalRequests / limit),
//       },
//   });
// });

// module.exports = { sentRequestTo, gotRequestFrom }