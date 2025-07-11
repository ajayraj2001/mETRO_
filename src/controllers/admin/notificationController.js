// adminNotificationController.js
const asyncHandler = require('express-async-handler');
const notificationService = require('../../utils/notificationService');
const AdminNotificationHistory = require('../../models/adminNotificationHistory');

// Send subscription offer notification
const sendSubscriptionOffer = asyncHandler(async (req, res) => {
  const adminId = req.admin._id;
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      message: 'Title and message are required'
    });
  }

  const result = await notificationService.sendSubscriptionOfferNotification(adminId, {
    title,
    message
  });

  res.status(200).json(result);
});

// Get notification history
const getNotificationHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const adminId = req.admin._id;

  const query = { adminId };
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [history, total] = await Promise.all([
    AdminNotificationHistory.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    AdminNotificationHistory.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: history,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// userNotificationController.js
const Notification = require('../models/notification.model');

// Get user notifications
const getUserNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20, type } = req.query;

  const skip = (page - 1) * limit;
  const query = { user: userId };
  
  if (type) {
    query.type = type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate('referenceId', 'fullName profile_image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ user: userId, isRead: false })
  ]);

  res.json({
    success: true,
    notifications,
    unreadCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Mark notification as read
const markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.json({
    success: true,
    message: 'Notification marked as read'
  });
});

// Mark all notifications as read
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true }
  );

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
});

// Delete notification
const deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const result = await Notification.deleteOne({
    _id: notificationId,
    user: userId
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

// notificationRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { adminProtect } = require('../middleware/adminAuthMiddleware');

// Admin routes
router.post('/admin/notifications/subscription-offer', adminProtect, sendSubscriptionOffer);
router.get('/admin/notifications/history', adminProtect, getNotificationHistory);

// User routes
router.get('/notifications', protect, getUserNotifications);
router.put('/notifications/:notificationId/read', protect, markAsRead);
router.put('/notifications/read-all', protect, markAllAsRead);
router.delete('/notifications/:notificationId', protect, deleteNotification);

module.exports = router;



// Updated likeUserProfile function
const likeUserProfile = asyncHandler(async (req, res, next) => {
  const { id: userLikedTo } = req.params;
  const user = req.user._id;
  const { fullName, profile_image } = req.user;

  try {
    const alreadyLiked = await Like.findOne({ user, userLikedTo });
    if (alreadyLiked) {
      return res.status(200).json({
        success: true,
        message: "You have already liked this profile.",
      });
    }

    await Like.create({ user, userLikedTo });
    await User.findByIdAndUpdate(userLikedTo, { $inc: { likeCount: 1 } });

    const likedUser = await User.findById(userLikedTo).select('deviceToken');

    // Create notification with type
    await Notification.create({
      user: userLikedTo,
      title: "❤️ Profile Liked",
      message: `${fullName} has liked your profile.`,
      pic: profile_image?.[0] || '', // First image only
      type: 'profile_liked',
      referenceId: user // Reference to the user who liked
    });

    // Send push notification
    if (likedUser?.deviceToken) {
      await sendFirebaseNotification(
        likedUser.deviceToken,
        "❤️ Profile Liked",
        `${fullName} has liked your profile.`
      );
    }

    return res.status(201).json({
      success: true,
      message: "User profile liked successfully.",
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "You have already liked this profile.",
      });
    }
    return next(err);
  }
});

// Usage Examples:

// 1. Send subscription offer notification
/*
POST /api/admin/notifications/subscription-offer
{
  "title": "🎉 50% Off on Gold Plan!",
  "message": "Limited time offer - Upgrade to Gold and save big! Valid till Sunday only."
}
*/

// 2. Get notification history
/*
GET /api/admin/notifications/history?page=1&limit=10&status=completed
*/

// 3. Get user notifications
/*
GET /api/notifications?page=1&limit=20&type=subscription_offer

Response includes:
{
  "notifications": [
    {
      "_id": "...",
      "title": "🎉 50% Off on Gold Plan!",
      "message": "Limited time offer...",
      "type": "subscription_offer",
      "referenceId": null,
      "pic": "",
      "isRead": false,
      "createdAt": "..."
    },
    {
      "_id": "...",
      "title": "💝 New Match Found!",
      "message": "John matches your preferences!",
      "type": "profile_match",
      "referenceId": {
        "_id": "userId",
        "fullName": "John",
        "profile_image": ["url1", "url2"]
      },
      "pic": "url1",
      "isRead": false,
      "createdAt": "..."
    }
  ]
}
*/

// Flutter app can use the 'type' field to determine navigation:
// - 'subscription_offer' -> Navigate to subscription page
// - 'profile_match' -> Navigate to profile page using referenceId
// - 'profile_liked' -> Navigate to profile page using referenceId
// - 'subscription_expiry' -> Navigate to subscription page
// - 'profile_incomplete' -> Navigate to profile edit page

module.exports = {
  sendSubscriptionOffer,
  getNotificationHistory,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  likeUserProfile
};