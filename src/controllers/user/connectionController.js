const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const { ApiError } = require("../../errorHandler");
const asyncHandler = require("../../utils/asyncHandler");
const { Connection, User, Report } = require("../../models"); // Renamed model
const Notification = require("../../models/notification");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");
const { getFileUploader } = require("../../middlewares/fileUpload")
const reportUpload = getFileUploader("evidence", "reports");

const sendOrUpdateRequest = asyncHandler(async (req, res, next) => {
  try {
    const { status } = req.body;

    let receiverId = req.body.receiverId || req.body.userRequestedTo;
    const senderId = req.user._id;
    const { fullName } = req.user;

    if (!receiverId) {
      return next(new ApiError("Receiver ID is required", 400));
    }

    if (senderId.toString() === receiverId.toString()) {
      return next(new ApiError("You cannot send a request to yourself", 403));
    }

    // ✅ Fetch receiver user
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return next(new ApiError("Receiver not found", 404));
    }

    const type = 'profile'
    // 🔒 Enhanced blocking check
    const blockedConnection = await Connection.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ],
      status: "Blocked"
    });

    if (blockedConnection) {
      // Check if there's any active block
      const isBlocked = blockedConnection.blockedBy && blockedConnection.blockedBy.length > 0;

      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Connection request not allowed. One of the users has blocked the other.",
        });
      }
    }

    // Find existing connection
    const existingConnection = await Connection.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    });

    if (existingConnection) {
      if (existingConnection.status === "Accepted") {
        return res.status(200).json({
          success: true,
          message: "You are already connected",
        });
      }

      if (existingConnection.sender.toString() === senderId.toString()) {
        return res.status(200).json({
          success: true,
          message: "You already have a pending request",
        });
      } else {
        if (status) {
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

            await Notification.create({
              user: existingConnection.sender,
              title: "Connection Request Accepted",
              message: `${fullName} has accepted your connection request`,
              referenceId: receiverId,
              type,
              pic: '',
            });

            const senderUser = await User.findById(existingConnection.sender);
            if (senderUser?.deviceToken) {
              await sendFirebaseNotification(
                senderUser.deviceToken,
                "Connection Request Accepted",
                `${fullName} has accepted your connection request`,
                receiverId,
                type,
                receiverId.profile_image[0]
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
          // Auto-accept if no status
          existingConnection.status = "Accepted";
          existingConnection.updatedAt = Date.now();
          await existingConnection.save();

          await Notification.create({
            user: existingConnection.sender,
            title: "Connection Request Accepted",
            message: `${fullName} has accepted your connection request`,
            referenceId: receiverId,
            type,
            pic: '',
          });

          const senderUser = await User.findById(existingConnection.sender);
          if (senderUser?.deviceToken) {
            await sendFirebaseNotification(
              senderUser.deviceToken,
              "Connection Request Accepted",
              `${fullName} has accepted your connection request`,
              receiverId,
              type,
              receiverId.profile_image[0]
            );
          }

          return res.status(200).json({
            success: true,
            message: "Connection request accepted",
          });
        }
      }
    } else {
      // No existing connection
      const newConnection = new Connection({
        sender: senderId,
        receiver: receiverId,
        status: "Pending"
      });

      await newConnection.save();

      await Notification.create({
        user: existingConnection.receiverId,
        title: "New Connection Request",
        message: `${fullName} has sent you request`,
        referenceId: senderId,
        type,
        pic: '',
      });

      if (receiver.deviceToken) {
        await sendFirebaseNotification(
          receiver.deviceToken,
          "New Connection Request",
          `${fullName} has sent you a connection request`,
          senderId,
          type,
          senderId.profile_image[0]
        );
      }

      return res.status(201).json({
        success: true,
        message: "Connection request sent successfully",
      });
    }
  } catch (error) {
    console.error("Error in sendOrUpdateRequest:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
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
        select: "fullName height city profile_image profileId"
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
        select: "fullName height city profile_image profileId"
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

const cancelRequest = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { connectionId } = req.params;

  // Validate connection ID
  if (!isValidObjectId(connectionId)) {
    return next(new ApiError("Invalid connection ID", 400));
  }

  // Find the connection first
  const connection = await Connection.findById(connectionId);

  if (!connection) {
    return next(new ApiError("Connection request not found", 404));
  }

  // Check if the connection can be cancelled/deleted
  let canDelete = false;
  let message = "";

  if (connection.status === "Pending") {
    // For pending requests: only sender can cancel OR receiver can decline (delete)
    if (connection.sender.toString() === userId.toString()) {
      canDelete = true;
      message = "Connection request cancelled successfully";
    } else if (connection.receiver.toString() === userId.toString()) {
      canDelete = true;
      message = "Connection request declined successfully";
    }
  } else if (connection.status === "Accepted") {
    // For accepted connections: either user can delete (disconnect)
    if (connection.sender.toString() === userId.toString() ||
      connection.receiver.toString() === userId.toString()) {
      canDelete = true;
      message = "Connection removed successfully";
    }
  }

  // If user cannot delete this connection
  if (!canDelete) {
    let errorMessage = "You cannot cancel this connection request";

    if (connection.status === "Blocked") {
      errorMessage = "Cannot cancel blocked connections";
    } else if (connection.status === "Declined") {
      errorMessage = "Connection request already declined";
    } else if (connection.status === "Pending") {
      errorMessage = "You can only cancel requests you sent or received";
    }

    return next(new ApiError(errorMessage, 403));
  }

  // Delete the connection
  await Connection.findByIdAndDelete(connectionId);

  return res.status(200).json({
    success: true,
    message: message,
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
        select: "fullName height city profile_image profileId"
      })
      .populate({
        path: "receiver",
        select: "fullName height city profile_image profileId"
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
  try {
    const { receiverId: userId } = req.body;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === userId.toString()) {
      return next(new ApiError("You cannot block yourself", 400));
    }

    // Check if user exists
    // const userToBlock = await User.findById(userId);
    // if (!userToBlock) {
    //   return next(new ApiError("User not found", 404));
    // }

    // Find existing connection
    let existingConnection = await Connection.findOne({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    });

    if (existingConnection) {
      // Initialize blockedBy array if it doesn't exist
      if (!existingConnection.blockedBy) {
        existingConnection.blockedBy = [];
      }
      if (!existingConnection.blockDetails) {
        existingConnection.blockDetails = [];
      }

      // Check if current user already blocked the other user
      const alreadyBlockedByCurrentUser = existingConnection.blockedBy.some(
        id => id.toString() === currentUserId.toString()
      );

      if (alreadyBlockedByCurrentUser) {
        return res.status(400).json({
          success: false,
          message: "You have already blocked this user"
        });
      }

      // If this is the first block, save previous status
      if (existingConnection.blockedBy.length === 0) {
        existingConnection.previousStatus = existingConnection.status;
      }

      // Add current user to blockedBy array
      existingConnection.blockedBy.push(currentUserId);

      // Add block details
      existingConnection.blockDetails.push({
        blockedBy: currentUserId,
        blockedAt: new Date(),
        isActive: true
      });

      // Update status and mutual blocking flag
      existingConnection.status = 'Blocked';
      existingConnection.isMutuallyBlocked = existingConnection.blockedBy.length > 1;

      await existingConnection.save();

    } else {
      // Create new blocked connection
      await Connection.create({
        sender: currentUserId,
        receiver: userId,
        status: 'Blocked',
        blockedBy: [currentUserId],
        blockDetails: [{
          blockedBy: currentUserId,
          blockedAt: new Date(),
          isActive: true
        }],
        isMutuallyBlocked: false
      });
    }

    res.status(200).json({
      success: true,
      message: "User blocked successfully"
    });

  } catch (error) {
    console.error("Error in blockUser:", error);
    return next(new ApiError("Failed to block user", 500));
  }
});


const unblockUser = asyncHandler(async (req, res, next) => {
  const { receiverId: userId } = req.body;
  const currentUserId = req.user._id;

  const connection = await Connection.findOne({
    $or: [
      { sender: currentUserId, receiver: userId },
      { sender: userId, receiver: currentUserId }
    ],
    status: 'Blocked'
  });

  if (!connection) {
    return next(new ApiError("No blocked connection found", 404));
  }

  // Check if current user has blocked the other user
  const hasBlockedOtherUser = connection.blockedBy && connection.blockedBy.some(
    id => id.toString() === currentUserId.toString()
  );

  if (!hasBlockedOtherUser) {
    return next(new ApiError("You haven't blocked this user", 400));
  }

  // Remove current user from blockedBy array
  connection.blockedBy = connection.blockedBy.filter(
    id => id.toString() !== currentUserId.toString()
  );

  // Deactivate the block detail for current user
  if (connection.blockDetails) {
    const blockDetail = connection.blockDetails.find(
      block => block.blockedBy.toString() === currentUserId.toString() && block.isActive
    );
    if (blockDetail) {
      blockDetail.isActive = false;
    }
  }

  // Check if there are still active blocks
  const stillBlocked = connection.blockedBy.length > 0;

  if (stillBlocked) {
    // Still blocked by other user
    connection.isMutuallyBlocked = false;
    // Status remains 'Blocked'
  } else {
    // No one is blocking anymore - restore previous status
    if (connection.previousStatus && connection.previousStatus !== 'Blocked') {
      connection.status = connection.previousStatus;
    } else {
      // If there was no previous status, delete the connection
      await Connection.findByIdAndDelete(connection._id);
      return res.status(200).json({
        success: true,
        message: "User unblocked successfully"
      });
    }
    connection.isMutuallyBlocked = false;
  }

  await connection.save();

  res.status(200).json({
    success: true,
    message: "User unblocked successfully"
  });
});

const getBlockedUsers = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get total count of blocked users (where current user is the blocker)
  const totalBlocked = await Connection.countDocuments({
    status: "Blocked",
    blockedBy: userId // Current user has blocked someone
  });

  // Get paginated blocked users sorted by most recent
  const blockedConnections = await Connection.find({
    status: "Blocked",
    blockedBy: userId // Current user has blocked someone
  })
    .populate("receiver", "fullName profile_image profileId")
    .populate("sender", "fullName profile_image profileId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Extract user info with proper null checks
  const blockedUsers = blockedConnections
    .map(conn => {
      // Check if both sender and receiver exist
      if (!conn.sender && !conn.receiver) {
        return null;
      }

      // If sender is null, but receiver exists and receiver is NOT current user
      if (!conn.sender && conn.receiver) {
        if (conn.receiver._id.toString() !== userId.toString()) {
          return conn.receiver;
        }
        return null;
      }

      // If receiver is null, but sender exists and sender is NOT current user
      if (!conn.receiver && conn.sender) {
        if (conn.sender._id.toString() !== userId.toString()) {
          return conn.sender;
        }
        return null;
      }

      // Both exist - return the other user (not current user)
      if (conn.sender && conn.receiver) {
        if (conn.sender._id.toString() === userId.toString()) {
          return conn.receiver;
        } else if (conn.receiver._id.toString() === userId.toString()) {
          return conn.sender;
        } else {
          // Neither sender nor receiver is current user - this shouldn't happen
          return null;
        }
      }

      return null;
    })
    .filter(user => user !== null); // Remove null entries

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


// Alternative cleaner approach using aggregation with better error handling

// const getBlockedUsers = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;
//   const skip = (page - 1) * limit;

//   const result = await Connection.aggregate([
//     {
//       $match: {
//         status: "Blocked",
//         blockedBy: userId
//       }
//     },
//     {
//       $addFields: {
//         blockedUserId: {
//           $cond: {
//             if: { $eq: ["$sender", userId] },
//             then: "$receiver",
//             else: "$sender"
//           }
//         },
//         // Find the current user's block date from blockDetails
//         currentUserBlockDate: {
//           $let: {
//             vars: {
//               currentUserBlock: {
//                 $filter: {
//                   input: "$blockDetails",
//                   as: "block",
//                   cond: { 
//                     $and: [
//                       { $eq: ["$$block.blockedBy", userId] },
//                       { $eq: ["$$block.isActive", true] }
//                     ]
//                   }
//                 }
//               }
//             },
//             in: {
//               $arrayElemAt: ["$$currentUserBlock.blockedAt", 0]
//             }
//           }
//         }
//       }
//     },
//     {
//       $match: {
//         blockedUserId: { $ne: null, $exists: true }
//       }
//     },
//     {
//       $lookup: {
//         from: "users",
//         localField: "blockedUserId",
//         foreignField: "_id",
//         as: "blockedUserInfo"
//       }
//     },
//     {
//       $unwind: {
//         path: "$blockedUserInfo",
//         preserveNullAndEmptyArrays: false // This will filter out null users
//       }
//     },
//     {
//       $project: {
//         _id: "$blockedUserInfo._id",
//         fullName: "$blockedUserInfo.fullName",
//         profile_image: "$blockedUserInfo.profile_image",
//         blockedAt: "$currentUserBlockDate" // Include block date for sorting
//       }
//     },
//     {
//       // Sort by block date (most recent first)
//       $sort: { blockedAt: -1 }
//     },
//     {
//       $skip: skip
//     },
//     {
//       $limit: limit
//     }
//   ]);

//   const totalBlocked = await Connection.countDocuments({
//     status: "Blocked",
//     blockedBy: userId
//   });

//   return res.status(200).json({
//     success: true,
//     data: result,
//     pagination: {
//       total: totalBlocked,
//       page,
//       pages: Math.ceil(totalBlocked / limit),
//       limit,
//       hasNextPages: page < Math.ceil(totalBlocked / limit),
//     }
//   });
// });

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