const mongoose = require("mongoose");
const asyncHandler = require("../../utils/asyncHandler");
const {Connection} = require("../../models");
const { isValidObjectId } = mongoose;

/**
 * Admin - View requests sent by a user (Pending)
 */
const sentRequestTo = asyncHandler(async (req, res, next) => {
  const { user } = req.params;
  if (!isValidObjectId(user)) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const totalRequests = await Connection.countDocuments({ sender: user, status: "Pending" });

  const sentRequests = await Connection.find({ sender: user, status: "Pending" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "receiver",
      select: "fullName height city profile_image",
    });

  return res.status(200).json({
    success: true,
    message: "Sent requests fetched successfully.",
    data: sentRequests,
    pagination: {
      total: totalRequests,
      page,
      limit,
      totalPages: Math.ceil(totalRequests / limit),
    },
  });
});

/**
 * Admin - View requests received by a user (Pending)
 */
const gotRequestFrom = asyncHandler(async (req, res, next) => {
  const { user } = req.params;
  if (!isValidObjectId(user)) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const totalRequests = await Connection.countDocuments({ receiver: user, status: "Pending" });

  const receivedRequests = await Connection.find({ receiver: user, status: "Pending" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "sender",
      select: "fullName height city profile_image",
    });

  return res.status(200).json({
    success: true,
    message: "Received requests fetched successfully.",
    data: receivedRequests,
    pagination: {
      total: totalRequests,
      page,
      limit,
      totalPages: Math.ceil(totalRequests / limit),
    },
  });
});

/**
 * Admin - View all accepted connections for a user
 */
const getUserConnections = asyncHandler(async (req, res, next) => {
  const { user } = req.params;
  if (!isValidObjectId(user)) {
    return res.status(400).json({ success: false, message: "Invalid user ID" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const totalConnections = await Connection.countDocuments({
    $or: [
      { sender: user, status: "Accepted" },
      { receiver: user, status: "Accepted" }
    ]
  });

  const connections = await Connection.find({
    $or: [
      { sender: user, status: "Accepted" },
      { receiver: user, status: "Accepted" }
    ]
  })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "fullName height city profile_image")
    .populate("receiver", "fullName height city profile_image");

  // Transform to show the other user
  const transformed = connections.map(conn => {
    const otherUser = conn.sender._id.toString() === user ? conn.receiver : conn.sender;
    return {
      connectionId: conn._id,
      user: otherUser,
      status: conn.status,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt
    };
  });

  return res.status(200).json({
    success: true,
    message: "User connections fetched successfully.",
    data: transformed,
    pagination: {
      total: totalConnections,
      page,
      limit,
      totalPages: Math.ceil(totalConnections / limit),
    },
  });
});

module.exports = {
  sentRequestTo,
  gotRequestFrom,
  getUserConnections
};
