const mongoose = require("mongoose");
const { User, Message } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

// const checkChatEligibility = asyncHandler(async (req, res, next) => {

//   const userId = req.user._id;

//   const user = await User.findById(userId);

//   const currentDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);

//   const obj = {};

//   // Check if the user has a valid subscription
//   if (user.subscriptionExpiryDate && user.subscriptionExpiryDate > currentDate) obj.isSubscribed = true;
//   else obj.isSubscribed = false;
    
//   obj.noOfFreeMessages = user.freeMessages;

//   res.status(200).json({
//     success: true,
//     message: "Message data fetched successfully",
//     data: obj,
//   });

// });



const chatList = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const recentChats = await Message.aggregate([
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
    {
      $sort: { lastMessageTime: -1 }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        userName: '$user.fullName',
        userProfilePic: { $arrayElemAt: ['$user.profile_image', 0] },
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
    }
  ]);

  res.status(200).json({
    success: true,
    message: "Chats fetched successfully",
    data: recentChats,
  });
});



const getChatMessages  = asyncHandler(async (req, res, next) => {
  const senderId = req.user._id;
  const { id : receiverId } = req.params;
  const { page = 1, limit = 30 } = req.query

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 30;

  // Update the isRead status for all messages where the recipient matches the current user
  const result = await Message.updateMany(
    {
      sender: receiverId,
      recipient: senderId,
      isRead: false, // Only update unread messages
    },
    { isRead: true } // Set isRead to true
  );

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

  // Get the total number of messages for pagination info
  const totalMessages = await Message.countDocuments({
    $or: [
      { sender: senderId, recipient: receiverId },
      { sender: receiverId, recipient: senderId },
    ],
  });

  res.status(200).json({
    success: true,
    message: "Message sent successfully",
    data: messages,
    currentPage: pageNum,
    totalPages: Math.ceil(totalMessages / limitNum),
    totalMessages
  });

});


module.exports = {
  //checkChatEligibility,
  chatList,
  getChatMessages
};
