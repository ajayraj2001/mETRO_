const mongoose = require("mongoose");
const { User, Message, Connection } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");


const chatList = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  const [recentChats, total] = await Promise.all([
    Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) },
            { recipient: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
              then: '$recipient',
              else: '$sender'
            }
          },
          lastMessage: { $last: '$message' },
          lastMessageTime: { $last: '$timestamp' },
          unreadCountForRecipient: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$recipient', new mongoose.Types.ObjectId(userId)] }, { $eq: ['$isRead', false] }] },
                1,
                0
              ]
            }
          },
          unreadCountForSender: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$sender', new mongoose.Types.ObjectId(userId)] }, { $eq: ['$isRead', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { lastMessageTime: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          userName: '$user.fullName',
          // userProfilePic: { $arrayElemAt: ['$user.profile_image', 0] },
          userProfilePic: {
            $ifNull: [
              { $arrayElemAt: ['$user.profile_image', 0] },
              ''
            ]
          },
          lastMessage: 1,
          lastMessageTime: 1,
          unreadCount: {
            $cond: {
              if: { $eq: ['$userId', new mongoose.Types.ObjectId(userId)] },
              then: '$unreadCountForSender',
              else: '$unreadCountForRecipient'
            }
          }
        }
      },
      { $skip: skip },
      { $limit: limit }
    ]),

    Message.countDocuments({
      $or: [
        { sender: new mongoose.Types.ObjectId(userId) },
        { recipient: new mongoose.Types.ObjectId(userId) }
      ]
    })
  ]);

  res.status(200).json({
    success: true,
    message: "Chats fetched successfully",
    data: recentChats,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    },
  });
});


//with chat permissions
// const getChatMessages = asyncHandler(async (req, res, next) => {
//   const senderId = req.user._id;
//   const { id: receiverId } = req.params;
//   const { page = 1, limit = 15 } = req.query;

//   const pageNum = parseInt(page) || 1;
//   const limitNum = parseInt(limit) || 15;

//   try {
//     // Fetch messages between the two users (paginated)
//     const messages = await Message.find({
//       $or: [
//         { sender: senderId, recipient: receiverId },
//         { sender: receiverId, recipient: senderId },
//       ]
//     })
//       .sort({ timestamp: -1 })
//       .skip((pageNum - 1) * limitNum)
//       .limit(limitNum)
//       .exec();

//     // Mark unread messages as read (from receiver to sender)
//     const unreadMessageIds = messages
//       .filter(msg => msg.sender.toString() === receiverId && !msg.isRead)
//       .map(msg => msg._id);

//     if (unreadMessageIds.length > 0) {
//       await Message.updateMany(
//         { _id: { $in: unreadMessageIds } },
//         { isRead: true, status: 'read' }
//       );

//       try {
//         const io = req.app.get('socketio');
//         const users = req.app.get('users') || {};
//         const senderSocketId = users[receiverId]?.socketId;

//         if (io && senderSocketId) {
//           io.to(senderSocketId).emit('messagesRead', {
//             messageIds: unreadMessageIds,
//             recipientId: senderId
//           });
//         }
//       } catch (error) {
//         console.error('Error emitting socket event:', error);
//       }
//     }

//     // Total message count for pagination
//     const totalMessages = await Message.countDocuments({
//       $or: [
//         { sender: senderId, recipient: receiverId },
//         { sender: receiverId, recipient: senderId },
//       ]
//     });

//     // Default flags (for pages > 1)
//     let blockedByOther = false;
//     let youBlocked = false;
//     let isConnected = false;
//     let canMessage = true;
//     let remainingMessages = null;

//     // Only fetch connection info on page 1
//     if (pageNum === 1) {
//       const [connections, totalSentByUser] = await Promise.all([
//         Connection.find({
//           $or: [
//             { sender: senderId, receiver: receiverId },
//             { sender: receiverId, receiver: senderId }
//           ]
//         }),
//         Message.countDocuments({ sender: senderId, recipient: receiverId })
//       ]);

//       for (const conn of connections) {
//         if (conn.status === 'Blocked') {
//           if (conn.sender.toString() === receiverId.toString()) blockedByOther = true;
//           if (conn.sender.toString() === senderId.toString()) youBlocked = true;
//         } else if (conn.status === 'Accepted') {
//           isConnected = true;
//         }
//       }

//       // Apply logic for canMessage & remainingMessages
//       if (blockedByOther || youBlocked) {
//         canMessage = false;
//       } else if (!isConnected) {
//         const remaining = 5 - totalSentByUser;
//         remainingMessages = remaining > 0 ? remaining : 0;
//         if (remaining <= 0) canMessage = false;
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: "Messages retrieved successfully",
//       data: messages,
//       pagination: {
//         currentPage: pageNum,
//         totalPages: Math.ceil(totalMessages / limitNum),
//         totalMessages
//       },
//       chatPermissions: pageNum === 1
//         ? {
//           blockedByOther,
//           youBlocked,
//           isConnected,
//           canMessage,
//           remainingMessages
//         }
//         : {
//           blockedByOther: false,
//           youBlocked: false,
//           isConnected: false,
//           canMessage: true,
//           remainingMessages: null
//         }
//     });
//   } catch (error) {
//     console.error('Error in getChatMessages:', error);
//     res.status(500).json({
//       success: false,
//       message: "Error retrieving messages",
//       error: error.message
//     });
//   }
// });

const getChatMessages = asyncHandler(async (req, res, next) => {
  const senderId = req.user._id;
  const { id: receiverId } = req.params;
  const { page = 1, limit = 15 } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 15;

  try {
    // Fetch messages between the two users (paginated)
    const messages = await Message.find({
      $or: [
        { sender: senderId, recipient: receiverId },
        { sender: receiverId, recipient: senderId },
      ]
    })
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .exec();

    // Mark unread messages as read (from receiver to sender)
    const unreadMessageIds = messages
      .filter(msg => msg.sender.toString() === receiverId && !msg.isRead)
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { isRead: true, status: 'read' }
      );

      try {
        const io = req.app.get('socketio');
        const users = req.app.get('users') || {};
        const senderSocketId = users[receiverId]?.socketId;

        if (io && senderSocketId) {
          io.to(senderSocketId).emit('messagesRead', {
            messageIds: unreadMessageIds,
            recipientId: senderId
          });
        }
      } catch (error) {
        console.error('Error emitting socket event:', error);
      }
    }

    // Total message count for pagination
    const totalMessages = await Message.countDocuments({
      $or: [
        { sender: senderId, recipient: receiverId },
        { sender: receiverId, recipient: senderId },
      ]
    });

    // Default flags (for pages > 1)
    let blockedByOther = false;
    let youBlocked = false;
    let isConnected = false;
    let canMessage = true;
    let remainingMessages = null;
    let deviceToken = null

    // Only fetch connection info on page 1
    if (pageNum === 1) {
      deviceToken  = req.user.deviceToken
      const [connections, totalSentByUser] = await Promise.all([
        Connection.find({
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId }
          ]
        }),
        Message.countDocuments({ sender: senderId, recipient: receiverId })
      ]);

      for (const conn of connections) {
        if (conn.status === 'Blocked') {
          // Enhanced blocking logic
          if (conn.blockedBy && conn.blockedBy.length > 0) {
            const blockedByCurrentUser = conn.blockedBy.some(
              id => id.toString() === senderId.toString()
            );
            const blockedByOtherUser = conn.blockedBy.some(
              id => id.toString() === receiverId.toString()
            );
            
            if (blockedByOtherUser) blockedByOther = true;
            if (blockedByCurrentUser) youBlocked = true;
          } else {
            // Fallback to old logic for backward compatibility
            if (conn.sender.toString() === receiverId.toString()) blockedByOther = true;
            if (conn.sender.toString() === senderId.toString()) youBlocked = true;
          }
        } else if (conn.status === 'Accepted') {
          isConnected = true;
        }
      }

      // Apply logic for canMessage & remainingMessages
      if (blockedByOther || youBlocked) {
        canMessage = false;
      } else if (!isConnected) {
        const remaining = 5 - totalSentByUser;
        remainingMessages = remaining > 0 ? remaining : 0;
        if (remaining <= 0) canMessage = false;
      }
    }

    res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      data: messages,
      deviceToken,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalMessages / limitNum),
        totalMessages
      },
      chatPermissions: pageNum === 1
        ? {
          blockedByOther,
          youBlocked,
          isConnected,
          canMessage,
          remainingMessages
        }
        : {
          blockedByOther: false,
          youBlocked: false,
          isConnected: false,
          canMessage: true,
          remainingMessages: null
        }
    });
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving messages",
      error: error.message
    });
  }
});

module.exports = {
  chatList,
  getChatMessages
};
