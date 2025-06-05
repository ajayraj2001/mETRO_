const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const { ApiError } = require("../../errorHandler");
const asyncHandler = require("../../utils/asyncHandler");
const { Connection, User, Report } = require("../../models"); // Renamed model
const Notification = require("../../models/notification");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");
const { getFileUploader } = require("../../middlewares/fileUpload")

const sendOrUpdateRequest = asyncHandler(async (req, res, next) => {
  const { receiverId, status } = req.body;
  const senderId = req.user._id;
  const { fullName, deviceToken, profile_image } = req.user;

  // Validation
  if (!receiverId) {
    return next(new ApiError("Receiver ID is required", 400));
  }

  if (senderId.toString() === receiverId.toString()) {
    return next(new ApiError("You cannot send a request to yourself", 403));
  }

  // Check if the receiver exists
  // const receiver = await User.findById(receiverId);
  // if (!receiver) {
  //   return next(new ApiError("Receiver not found", 404));
  // }


  // 🔒 Check if either user has blocked the other
  const blockedConnection = await Connection.findOne({
    $or: [
      { sender: senderId, receiver: receiverId, status: "Blocked" },
      { sender: receiverId, receiver: senderId, status: "Blocked" }
    ]
  });

  if (blockedConnection) {
    return res.status(403).json({
      success: false,
      message: "Connection request not allowed. One of the users has blocked the other.",
    });
  }


  // Find existing connection between these users (in either direction)
  const existingConnection = await Connection.findOne({
    $or: [
      { sender: senderId, receiver: receiverId },
      { sender: receiverId, receiver: senderId }
    ]
  });

  // If existing connection found
  if (existingConnection) {
    // Check if already connected
    if (existingConnection.status === "Accepted") {
      return res.status(200).json({
        success: true,
        message: "You are already connected",
      });
    }

    // Existing connection is Pending
    if (existingConnection.sender.toString() === senderId.toString()) {
      // Current user is the sender of the pending request
      return res.status(200).json({
        success: true,
        message: "You already have a pending request",
      });
    } else {
      // Current user is the receiver of the pending request
      if (status) {
        // Handle accept/decline using status parameter
        if (status === "Declined") {
          await Connection.findByIdAndDelete(existingConnection._id);
          return res.status(200).json({
            success: true,
            message: "Connection request declined",
          });
        } else if (status === "Accepted") {
          existingConnection.status = "Accepted";
          existingConnection.updatedAt = Date.now();
          await existingConnection.save();

          // Notify original sender
          await Notification.create({
            user: existingConnection.sender,
            title: "Connection Request Accepted",
            message: `${fullName} has accepted your connection request`,
            pic: profile_image,
          });

          // Send push notification to original sender
          const senderUser = await User.findById(existingConnection.sender);
          if (senderUser?.deviceToken) {
            await sendFirebaseNotification(
              senderUser.deviceToken,
              "Connection Request Accepted",
              `${fullName} has accepted your connection request`
            );
          }

          return res.status(200).json({
            success: true,
            message: "Connection request accepted",
          });
        } else {
          return next(new ApiError("Invalid status value", 400));
        }
      } else {
        // No status provided: Auto-accept the pending request
        existingConnection.status = "Accepted";
        existingConnection.updatedAt = Date.now();
        await existingConnection.save();

        // Notify original sender
        await Notification.create({
          user: existingConnection.sender,
          title: "Connection Request Accepted",
          message: `${fullName} has accepted your connection request`,
          pic: profile_image,
        });

        // Send push notification to original sender
        const senderUser = await User.findById(existingConnection.sender);
        if (senderUser?.deviceToken) {
          await sendFirebaseNotification(
            senderUser.deviceToken,
            "Connection Request Accepted",
            `${fullName} has accepted your connection request`
          );
        }

        return res.status(200).json({
          success: true,
          message: "Connection request accepted",
        });
      }
    }
  } else {
    // No existing connection: Create new request
    const newConnection = new Connection({
      sender: senderId,
      receiver: receiverId,
      status: "Pending"
    });

    await newConnection.save();

    // Create notification for receiver
    await Notification.create({
      user: receiverId,
      title: "New Connection Request",
      message: `${fullName} has sent you a connection request`,
      pic: profile_image
    });

    // Send push notification to receiver
    if (receiver.deviceToken) {
      await sendFirebaseNotification(
        receiver.deviceToken,
        "New Connection Request",
        `${fullName} has sent you a connection request`
      );
    }

    return res.status(201).json({
      success: true,
      message: "Connection request sent successfully",
    });
  }
});

/**
 * Get all requests sent by the current user
 */
const getSentRequests = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  // Get requests sent by the user with pagination
  const [sentRequests, total] = await Promise.all([
    Connection.find({ sender: userId, status: "Pending" })
      .sort({ createdAt: -1 })
      .populate({
        path: "receiver",
        select: "fullName height city profile_image"
      })
      .skip(skip)
      .limit(limit),
    Connection.countDocuments({ sender: userId, status: "Pending" })
  ]);

  return res.status(200).json({
    success: true,
    message: "Sent requests fetched successfully",
    data: sentRequests,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    },
  });
});

/**
 * Get all requests received by the current user
 */
const getReceivedRequests = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  // Get requests received by the user with pagination
  const [receivedRequests, total] = await Promise.all([
    Connection.find({ receiver: userId, status: "Pending" })
      .sort({ createdAt: -1 })
      .populate({
        path: "sender",
        select: "fullName height city profile_image"
      })
      .skip(skip)
      .limit(limit),
    Connection.countDocuments({ receiver: userId, status: "Pending" })
  ]);

  return res.status(200).json({
    success: true,
    message: "Received requests fetched successfully",
    data: receivedRequests,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    },
  });
});

/**
 * Cancel a sent request
 */
const cancelRequest = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { connectionId } = req.params;

  // Validate connection ID
  if (!isValidObjectId(connectionId)) {
    return next(new ApiError("Invalid connection ID", 400));
  }

  // Find and delete the connection
  // const connection = await Connection.findOneAndDelete({
  //   _id: connectionId,
  //   sender: userId,
  //   status: "Pending"
  // });
  const connection = await Connection.findByIdAndDelete(connectionId);

  if (!connection) {
    return next(new ApiError("Connection request not found or cannot be cancelled", 404));
  }

  return res.status(200).json({
    success: true,
    message: "Connection request cancelled successfully",
  });
});

/**
 * Get all connections (matches)
 */
const getConnections = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  // Get all accepted connections for the user
  const [connections, total] = await Promise.all([
    Connection.find({
      $or: [
        { sender: userId, status: "Accepted" },
        { receiver: userId, status: "Accepted" }
      ]
    })
      .sort({ updatedAt: -1 })
      .populate({
        path: "sender",
        select: "fullName height city profile_image"
      })
      .populate({
        path: "receiver",
        select: "fullName height city profile_image"
      })
      .skip(skip)
      .limit(limit),
    Connection.countDocuments({
      $or: [
        { sender: userId, status: "Accepted" },
        { receiver: userId, status: "Accepted" }
      ]
    })
  ]);

  // Transform the data to show the other person
  const transformedConnections = connections.map(conn => {
    const otherUser = conn.sender.toString() === userId.toString() ? conn.receiver : conn.sender;
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
    message: "Connections fetched successfully",
    data: transformedConnections,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    },
  });
});

/**
 * Check if users can message each other
 */
// const canMessage = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;
//   const { otherUserId } = req.params;

//   // Check if connection exists and is accepted
//   const connection = await Connection.findOne({
//     $or: [
//       { sender: userId, receiver: otherUserId, status: "Accepted" },
//       { sender: otherUserId, receiver: userId, status: "Accepted" }
//     ]
//   });

//   if (!connection) {
//     return next(new ApiError("You are not connected with this user", 403));
//   }

//   return res.status(200).json({
//     success: true,
//     message: "You can message this user",
//     canMessage: true
//   });
// });

const canMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;

  // 1. Check if either user has blocked the other
  const blocked = await Connection.findOne({
    $or: [
      { sender: userId, receiver: otherUserId, status: "Blocked" },
      { sender: otherUserId, receiver: userId, status: "Blocked" }
    ]
  });

  if (blocked) {
    return res.status(403).json({
      success: false,
      message: "You are blocked by this user or you have blocked them.",
      canMessage: false
    });
  }

  // 2. Check if there is an accepted connection
  const connection = await Connection.findOne({
    $or: [
      { sender: userId, receiver: otherUserId, status: "Accepted" },
      { sender: otherUserId, receiver: userId, status: "Accepted" }
    ]
  });

  if (connection) {
    return res.status(200).json({
      success: true,
      message: "You can message this user.",
      canMessage: true
    });
  }

  // 3. Check message count if no accepted connection
  const messageCount = await Message.countDocuments({
    sender: userId,
    recipient: otherUserId
  });

  if (messageCount < 2) {
    return res.status(200).json({
      success: true,
      messageCount,
      message: `You can send ${2 - messageCount} more message(s) until connection is accepted.`,
      canMessage: true,
      isLimited: true
    });
  }

  return res.status(403).json({
    success: false,
    message: "You can no longer message this user until they accept your request.",
    canMessage: false,
    isLimited: true
  });
});


const blockUser = asyncHandler(async (req, res, next) => {
  const senderId = req.user._id;
  const { receiverId } = req.body;

  if (!receiverId || senderId.toString() === receiverId) {
    return next(new ApiError("Invalid receiver ID", 400));
  }

  // Remove any existing connections
  await Connection.deleteMany({
    $or: [
      { sender: senderId, receiver: receiverId },
      { sender: receiverId, receiver: senderId }
    ]
  });

  // Add block record
  const block = new Connection({
    sender: senderId,
    receiver: receiverId,
    status: "Blocked"
  });
  await block.save();

  res.status(200).json({ success: true, message: "User blocked successfully" });
});

const getBlockedUsers = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get total count of blocked users
  const totalBlocked = await Connection.countDocuments({
    sender: userId,
    status: "Blocked"
  });

  // Get paginated blocked users sorted by most recent
  const blockedConnections = await Connection.find({
    sender: userId,
    status: "Blocked"
  })
    .populate("receiver", "fullName profile_image") // Add more fields if needed
    .sort({ createdAt: -1 }) // 🔄 Most recently blocked users first
    .skip(skip)
    .limit(limit)
    .lean();

  // Extract user info
  const blockedUsers = blockedConnections.map(conn => conn.receiver);

  return res.status(200).json({
    success: true,
    data: blockedUsers,
    pagination: {
      total: totalBlocked,
      page,
      pages: Math.ceil(totalBlocked / limit),
      limit,
      hasNextPages: page < Math.ceil(totalBlocked / limit),
    }
  });
});



const unblockUser = asyncHandler(async (req, res, next) => {
  const senderId = req.user._id;
  const { receiverId } = req.body;

  if (!receiverId) {
    return next(new ApiError("Receiver ID is required", 400));
  }

  const deleted = await Connection.findOneAndDelete({
    sender: senderId,
    receiver: receiverId,
    status: "Blocked"
  });

  if (!deleted) {
    return next(new ApiError("No block found for this user", 404));
  }

  res.status(200).json({
    success: true,
    message: "User unblocked successfully"
  });
});



const reportUpload = getFileUploader("evidence", "reports");

const reportUser = (req, res, next) => {
  reportUpload(req, res, async (err) => {
    try {
      if (err) throw new ApiError(err.message, 400);

      const reporter = req.user._id;
      const { reportedUser, reason } = req.body;

      if (!reportedUser || !reason) {
        return next(new ApiError("Reported user and reason are required", 400));
      }

      let imgPath = ''

      if (req.file) {
        imgPath = `/reports/${req.file.filename}`;
      }

      const report = new Report({
        reporter,
        reportedUser,
        reason,
        evidence: imgPath,
      });

      await report.save();

      return res.status(201).json({
        success: true,
        message: "User reported successfully",
        data: report
      });
    } catch (error) {
      next(error);
    }
  });
};

module.exports = {
  sendOrUpdateRequest,
  getSentRequests,
  getReceivedRequests,
  cancelRequest,
  getConnections,
  canMessage,
  blockUser,
  reportUser,
  getBlockedUsers,
  unblockUser
};