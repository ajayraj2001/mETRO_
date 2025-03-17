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