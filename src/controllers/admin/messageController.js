const mongoose = require("mongoose");
const { User, Message } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");

const chatList = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  let { page = 1, limit = 15 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

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
      $sort: { timestamp: -1 } // Sort messages by latest timestamp first
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
        lastMessage: { $first: '$message' }, // Get latest message
        lastMessageTime: { $first: '$timestamp' }
      }
    },
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
        userProfilePic: { $arrayElemAt: ['$user.profile_image', 0] },
        lastMessage: 1,
        lastMessageTime: 1
      }
    },
    { $sort: { lastMessageTime: -1 } }, // Sort by latest chat interaction
    { $skip: skip },
    { $limit: limit }
  ]);

  const totalUsers = await Message.aggregate([
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
  ]);

  const total = totalUsers.length > 0 ? totalUsers[0].total : 0;

  res.status(200).json({
    success: true,
    message: "Chats fetched successfully",
    data: recentChats,
    pagination: {
      total: total,
      page: page,
      totalPages: Math.ceil(total / limit),
      limit: limit,
    },
  });
});


const getChatMessages = asyncHandler(async (req, res, next) => {
  const { senderId, receiverId, page = 1, limit = 15 } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

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
    message: "Messages get successfully",
    data: messages,
    pagination: {
      total: totalMessages,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalMessages / limitNum),
    },
  });

});

module.exports = { chatList, getChatMessages }