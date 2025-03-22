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
          lastMessageTime: { $last: '$timestamp' }
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
          userProfilePic: { $arrayElemAt: ['$user.profile_image', 0] },
          lastMessage: 1,
          lastMessageTime: 1
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



const getChatMessages  = asyncHandler(async (req, res, next) => {
  const senderId = req.user._id;
  const { id : receiverId } = req.params;
  const { page = 1, limit = 15 } = req.query

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

module.exports = { chatList, getChatMessages}