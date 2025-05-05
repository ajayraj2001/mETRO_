const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const { ApiError } = require("../../errorHandler");
const asyncHandler = require("../../utils/asyncHandler");
const {Connection , User} = require("../../models"); // Renamed model
const Notification = require("../../models/notification");
const sendFirebaseNotification = require("../../utils/sendFirebaseNotification");

/**
 * Send a connection request or update an existing one
 */
// const sendOrUpdateRequest = asyncHandler(async (req, res, next) => {
//   const { receiverId, status } = req.body;
//   const senderId = req.user._id;
//   // const senderId = "67fcb57a240b92d1cbd38bd2";
//   const { fullName, deviceToken, profile_image } = req.user;
  
//   // Validation
//   if (!receiverId) {
//     return next(new ApiError("Receiver ID is required", 400));
//   }

//   if (senderId.toString() === receiverId.toString()) {
//     return next(new ApiError("You cannot send a request to yourself", 403));
//   }

//   // Check if the receiver exists
//   const receiver = await User.findById(receiverId);
//   if (!receiver) {
//     return next(new ApiError("Receiver not found", 404));
//   }

//   // Find existing connection between these users (in either direction)
//   const existingConnection = await Connection.findOne({
//     $or: [
//       { sender: senderId, receiver: receiverId },
//       { sender: receiverId, receiver: senderId }
//     ]
//   });

//   // If updating an existing connection
//   if (existingConnection) {
//     // Only receiver can accept/decline a request
//     if (status && existingConnection.sender.toString() !== senderId.toString()) {
//       if (status === "Declined") {
//         await Connection.findByIdAndDelete(existingConnection._id);
//         return res.status(200).json({
//           success: true,
//           message: "Connection request declined",
//         });
//       } else if (status === "Accepted") {
//         existingConnection.status = status;
//         existingConnection.updatedAt = Date.now();
//         await existingConnection.save();
        
//         // Create notification for the original sender
//         await Notification.create({
//           user: existingConnection.sender,
//           title: "Connection Request Accepted",
//           message: `${fullName} has accepted your connection request`,
//           pic: profile_image,
//         });

//         // Send push notification
//         await sendFirebaseNotification(
//           receiver.deviceToken,
//           "Connection Request Accepted",
//           `${fullName} has accepted your connection request`
//         );

//         return res.status(200).json({
//           success: true,
//           message: "Connection request accepted",
//         });
//       }
//     } else if (existingConnection.sender.toString() === senderId.toString() && 
//               existingConnection.status === "Pending") {
//       // Sender can cancel their own pending request
//       await Connection.findByIdAndDelete(existingConnection._id);
//       return res.status(200).json({
//         success: true,
//         message: "Connection request cancelled",
//       });
//     } else {
//       return next(new ApiError("You cannot modify this connection", 403));
//     }
//   } else {
//     // Create new connection request
//     const newConnection = new Connection({ 
//       sender: senderId, 
//       receiver: receiverId,
//       status: "Pending" 
//     });

//     await newConnection.save();

//     // Create notification
//     await Notification.create({
//       user: receiverId,
//       title: "New Connection Request",
//       message: `${fullName} has sent you a connection request`,
//       pic: profile_image
//     });

//     // Send push notification
//     await sendFirebaseNotification(
//       receiver.deviceToken,
//       "New Connection Request",
//       `${fullName} has sent you a connection request`
//     );

//     return res.status(201).json({
//       success: true,
//       message: "Connection request sent successfully",
//     });
//   }
// });

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
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    return next(new ApiError("Receiver not found", 404));
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
      return next(new ApiError("You are already connected", 400));
    }

    // Existing connection is Pending
    if (existingConnection.sender.toString() === senderId.toString()) {
      // Current user is the sender of the pending request
      return next(new ApiError("You already have a pending request", 400));
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
const canMessage = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;

  // Check if connection exists and is accepted
  const connection = await Connection.findOne({
    $or: [
      { sender: userId, receiver: otherUserId, status: "Accepted" },
      { sender: otherUserId, receiver: userId, status: "Accepted" }
    ]
  });

  if (!connection) {
    return next(new ApiError("You are not connected with this user", 403));
  }

  return res.status(200).json({
    success: true,
    message: "You can message this user",
    canMessage: true
  });
});

module.exports = {
  sendOrUpdateRequest,
  getSentRequests,
  getReceivedRequests,
  cancelRequest,
  getConnections,
  canMessage
};