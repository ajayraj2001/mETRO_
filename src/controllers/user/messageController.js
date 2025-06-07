const mongoose = require("mongoose");
const { User, Message, Connection } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");


// const chatList = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;
//   let { page = 1, limit = 10 } = req.query;

//   page = parseInt(page);
//   limit = parseInt(limit);
//   const skip = (page - 1) * limit;

//   const [recentChats, total] = await Promise.all([
//     Message.aggregate([
//       {
//         $match: {
//           $or: [
//             { sender: new mongoose.Types.ObjectId(userId) },
//             { recipient: new mongoose.Types.ObjectId(userId) }
//           ]
//         }
//       },
//       {
//         $group: {
//           _id: {
//             $cond: {
//               if: { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
//               then: '$recipient',
//               else: '$sender'
//             }
//           },
//           lastMessage: { $last: '$message' },
//           lastMessageTime: { $last: '$timestamp' },
//           unreadCountForRecipient: {
//             $sum: {
//               $cond: [
//                 { $and: [{ $eq: ['$recipient', new mongoose.Types.ObjectId(userId)] }, { $eq: ['$isRead', false] }] },
//                 1,
//                 0
//               ]
//             }
//           },
//           unreadCountForSender: {
//             $sum: {
//               $cond: [
//                 { $and: [{ $eq: ['$sender', new mongoose.Types.ObjectId(userId)] }, { $eq: ['$isRead', false] }] },
//                 1,
//                 0
//               ]
//             }
//           }
//         }
//       },
//       { $sort: { lastMessageTime: -1 } },
//       {
//         $lookup: {
//           from: 'users',
//           localField: '_id',
//           foreignField: '_id',
//           as: 'user'
//         }
//       },
//       { $unwind: '$user' },
//       {
//         $project: {
//           _id: 0,
//           userId: '$_id',
//           userName: '$user.fullName',
//           // userProfilePic: { $arrayElemAt: ['$user.profile_image', 0] },
//           userProfilePic: {
//             $ifNull: [
//               { $arrayElemAt: ['$user.profile_image', 0] },
//               ''
//             ]
//           },
//           lastMessage: 1,
//           lastMessageTime: 1,
//           unreadCount: {
//             $cond: {
//               if: { $eq: ['$userId', new mongoose.Types.ObjectId(userId)] },
//               then: '$unreadCountForSender',
//               else: '$unreadCountForRecipient'
//             }
//           }
//         }
//       },
//       { $skip: skip },
//       { $limit: limit }
//     ]),

//     Message.countDocuments({
//       $or: [
//         { sender: new mongoose.Types.ObjectId(userId) },
//         { recipient: new mongoose.Types.ObjectId(userId) }
//       ]
//     })
//   ]);

//   res.status(200).json({
//     success: true,
//     message: "Chats fetched successfully",
//     data: recentChats,
//     pagination: {
//       totalRecords: total,
//       currentPage: page,
//       totalPages: Math.ceil(total / limit),
//       perPage: limit,
//     },
//   });
// });


// Modified getChatMessages API endpoint to handle message reading properly
// const getChatMessages = asyncHandler(async (req, res, next) => {
//   const senderId = req.user._id;
//   const { id: receiverId } = req.params;
//   const { page = 1, limit = 15 } = req.query;

//   const pageNum = parseInt(page) || 1;
//   const limitNum = parseInt(limit) || 30;

//   try {
//     // Find all messages between the two users (without updating anything)
//     const messages = await Message.find({
//       $or: [
//         { sender: senderId, recipient: receiverId },
//         { sender: receiverId, recipient: senderId },
//       ],
//     })
//       .sort({ timestamp: -1 })
//       .skip((pageNum - 1) * limitNum)
//       .limit(limitNum)
//       .exec();

//     // Find unread messages from the recipient to mark as read
//     const unreadMessageIds = messages
//       .filter(msg => msg.sender.toString() === receiverId && !msg.isRead)
//       .map(msg => msg._id);

//     // If there are unread messages, mark them as read
//     if (unreadMessageIds.length > 0) {
//       console.log(`Marking ${unreadMessageIds.length} messages as read`);

//       // Update the messages in the database
//       await Message.updateMany(
//         { _id: { $in: unreadMessageIds } },
//         { isRead: true, status: 'read' }
//       );

//       // Also emit a socket event to notify the sender
//       // This will be handled if you have socket.io available in this context
//       // If not, you'll need to adjust your server architecture
//       try {
//         const io = req.app.get('socketio');

//         // Get the sender's socket ID from your users object
//         const users = req.app.get('users') || {};
//         const senderSocketId = users[receiverId]?.socketId;

//         if (io && senderSocketId) {
//           io.to(senderSocketId).emit('messagesRead', {
//             messageIds: unreadMessageIds,
//             recipientId: senderId
//           });
//           console.log(`Emitted messagesRead event to socket ${senderSocketId}`);
//         } else {
//           console.log('Could not emit socket event: socketio or user not found');
//         }
//       } catch (error) {
//         console.error('Error emitting socket event:', error);
//       }
//     }

//     // Get the total number of messages for pagination info
//     const totalMessages = await Message.countDocuments({
//       $or: [
//         { sender: senderId, recipient: receiverId },
//         { sender: receiverId, recipient: senderId },
//       ],
//     });

//     res.status(200).json({
//       success: true,
//       message: "Messages retrieved successfully",
//       data: messages,
//       currentPage: pageNum,
//       totalPages: Math.ceil(totalMessages / limitNum),
//       totalMessages
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
          totalSentByUser: {
            $sum: {
              $cond: [
                { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
                1,
                0
              ]
            }
          },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient', new mongoose.Types.ObjectId(userId)] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { lastMessageTime: -1 } },

      // Lookup user info
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },

      // Lookup block connection where THEY blocked ME
      {
        $lookup: {
          from: 'connections',
          let: { chatUserId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sender', '$$chatUserId'] },
                    { $eq: ['$receiver', new mongoose.Types.ObjectId(userId)] },
                    { $eq: ['$status', 'Blocked'] }
                  ]
                }
              }
            }
          ],
          as: 'blockedByOther'
        }
      },

      // Lookup connection where YOU blocked THEM
      {
        $lookup: {
          from: 'connections',
          let: { chatUserId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
                    { $eq: ['$receiver', '$$chatUserId'] },
                    { $eq: ['$status', 'Blocked'] }
                  ]
                }
              }
            }
          ],
          as: 'youBlockedOther'
        }
      },

      // Lookup accepted connection (mutual)
      {
        $lookup: {
          from: 'connections',
          let: { chatUserId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $eq: ['$sender', '$$chatUserId'] },
                        { $eq: ['$receiver', new mongoose.Types.ObjectId(userId)] },
                        { $eq: ['$status', 'Accepted'] }
                      ]
                    },
                    {
                      $and: [
                        { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
                        { $eq: ['$receiver', '$$chatUserId'] },
                        { $eq: ['$status', 'Accepted'] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'connectionStatus'
        }
      },

      {
        $project: {
          userId: '$_id',
          lastMessage: 1,
          lastMessageTime: 1,
          unreadCount: 1,
          totalSentByUser: 1,
          isBlockedByOther: { $gt: [{ $size: '$blockedByOther' }, 0] },
          youBlockedOther: { $gt: [{ $size: '$youBlockedOther' }, 0] },
          isConnected: { $gt: [{ $size: '$connectionStatus' }, 0] },

          userName: {
            $cond: {
              if: { $gt: [{ $size: '$blockedByOther' }, 0] },
              then: 'Blocked User',
              else: '$user.fullName'
            }
          },
          userProfilePic: {
            $cond: {
              if: { $gt: [{ $size: '$blockedByOther' }, 0] },
              then: '',
              else: {
                $ifNull: [
                  { $arrayElemAt: ['$user.profile_image', 0] },
                  ''
                ]
              }
            }
          },

          canMessage: {
            $cond: {
              if: {
                $or: [
                  { $gt: [{ $size: '$blockedByOther' }, 0] },
                  { $gt: [{ $size: '$youBlockedOther' }, 0] }
                ]
              },
              then: false,
              else: true
            }
          },

          remainingMessages: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $size: '$connectionStatus' }, 0] },
                  {
                    $and: [
                      { $eq: [{ $size: '$blockedByOther' }, 0] },
                      { $eq: [{ $size: '$youBlockedOther' }, 0] }
                    ]
                  }
                ]
              },
              then: { $subtract: [2, '$totalSentByUser'] },
              else: null
            }
          }
        }
      },

      { $skip: skip },
      { $limit: limit }
    ]),

    // Count total chat threads
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
          }
        }
      },
      { $count: "total" }
    ]).then(res => res[0]?.total || 0)
  ]);

  res.status(200).json({
    success: true,
    message: "Chat list fetched successfully",
    data: recentChats,
    pagination: {
      totalRecords: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit
    }
  });
});


const getChatThread = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  const { page = 1, limit = 15 } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  // 🔍 Step 1: Check if either user has blocked the other
  const blocked = await Connection.findOne({
    $or: [
      { sender: userId, receiver: otherUserId, status: "Blocked" },
      { sender: otherUserId, receiver: userId, status: "Blocked" }
    ]
  }).select("status");

  let canMessage = true;
  let messageStatus = "You can message this user.";
  let blockType = null;

  if (blocked) {
    canMessage = false;
    blockType = (blocked.sender.toString() === otherUserId)
      ? "blockedByOther"
      : "youBlockedOther";
    messageStatus = (blockType === "blockedByOther")
      ? "You are blocked by this user. You cannot send new messages."
      : "You have blocked this user. You cannot send new messages.";
  }

  let isConnected = false;
  let remainingMessages = 2;

  // ✅ Step 2: Only check connection if not blocked
  if (canMessage) {
    const connection = await Connection.findOne({
      $or: [
        { sender: userId, receiver: otherUserId, status: "Accepted" },
        { sender: otherUserId, receiver: userId, status: "Accepted" }
      ]
    }).select("status");

    isConnected = !!connection;

    // Step 3: Not connected → Check 2-message rule
    if (!isConnected) {
      const sentCount = await Message.countDocuments({
        sender: userId,
        recipient: otherUserId
      });

      remainingMessages = 2 - sentCount;
      if (sentCount >= 2) {
        canMessage = false;
        messageStatus = "You reached your 2-message limit. Wait for connection acceptance.";
      } else {
        messageStatus = `You can send ${remainingMessages} more message(s).`;
      }
    }
  }

  // 🔄 Step 4: Fetch messages (always allowed)
  const messages = await Message.find({
    $or: [
      { sender: userId, recipient: otherUserId },
      { sender: otherUserId, recipient: userId }
    ]
  })
    .sort({ timestamp: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  // ✅ Step 5: Mark unread as read
  const unreadMessageIds = messages
    .filter(msg => msg.sender.toString() === otherUserId && !msg.isRead)
    .map(msg => msg._id);

  if (unreadMessageIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: unreadMessageIds } },
      { isRead: true, status: 'read' }
    );

    try {
      const io = req.app.get('socketio');
      const users = req.app.get('users') || {};
      const senderSocketId = users[otherUserId]?.socketId;

      if (io && senderSocketId) {
        io.to(senderSocketId).emit('messagesRead', {
          messageIds: unreadMessageIds,
          recipientId: userId
        });
      }
    } catch (err) {
      console.log("Socket emit failed", err.message);
    }
  }

  // 🔢 Step 6: Pagination metadata
  const totalMessages = await Message.countDocuments({
    $or: [
      { sender: userId, recipient: otherUserId },
      { sender: otherUserId, recipient: userId }
    ]
  });

  // 📦 Final response
  return res.status(200).json({
    success: true,
    data: messages,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalMessages / limitNum),
      totalMessages
    },
    canMessage,
    isBlocked: !!blocked,
    isConnected,
    messageStatus,
    blockType,
    remainingMessages: canMessage && !isConnected ? remainingMessages : undefined
  });
});

const getChatMessages = asyncHandler(async (req, res, next) => {
  const senderId = req.user._id;
  const { id: receiverId } = req.params;
  const { page = 1, limit = 15 } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 30;

  try {
    // Find all messages between the two users (without updating anything)
    const messages = await Message.find({
      $or: [
        { sender: senderId, recipient: receiverId },
        { sender: receiverId, recipient: senderId },
      ],
    })
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .exec();

    // Find unread messages from the recipient to mark as read
    const unreadMessageIds = messages
      .filter(msg => msg.sender.toString() === receiverId && !msg.isRead)
      .map(msg => msg._id);

    // If there are unread messages, mark them as read
    if (unreadMessageIds.length > 0) {
      console.log(`Marking ${unreadMessageIds.length} messages as read`);

      // Update the messages in the database
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { isRead: true, status: 'read' }
      );

      // Also emit a socket event to notify the sender
      // This will be handled if you have socket.io available in this context
      // If not, you'll need to adjust your server architecture
      try {
        const io = req.app.get('socketio');

        // Get the sender's socket ID from your users object
        const users = req.app.get('users') || {};
        const senderSocketId = users[receiverId]?.socketId;

        if (io && senderSocketId) {
          io.to(senderSocketId).emit('messagesRead', {
            messageIds: unreadMessageIds,
            recipientId: senderId
          });
          console.log(`Emitted messagesRead event to socket ${senderSocketId}`);
        } else {
          console.log('Could not emit socket event: socketio or user not found');
        }
      } catch (error) {
        console.error('Error emitting socket event:', error);
      }
    }

    // Get the total number of messages for pagination info
    const totalMessages = await Message.countDocuments({
      $or: [
        { sender: senderId, recipient: receiverId },
        { sender: receiverId, recipient: senderId },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      data: messages,
      currentPage: pageNum,
      totalPages: Math.ceil(totalMessages / limitNum),
      totalMessages
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
