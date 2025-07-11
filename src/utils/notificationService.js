// notificationService.js
const Notification = require('../models/notification.model');
const AdminNotificationHistory = require('../models/adminNotificationHistory.model');
const User = require('../models/user.model');
const UserSubscription = require('../models/userSubscription.model');
const PartnerPreferences = require('../models/partnerPreferences.model');
const sendFirebaseNotification = require('../utils/sendFirebaseNotification');

class NotificationService {
  constructor() {
    this.batchSize = 100;
    this.delayBetweenBatches = 500;
  }

  // Send subscription offer notification
  async sendSubscriptionOfferNotification(adminId, notificationData) {
    const { title, message } = notificationData;

    // Create history record
    const history = await AdminNotificationHistory.create({
      adminId,
      title,
      message,
      type: 'subscription_offer',
      status: 'processing'
    });

    // Process in background
    this.processSubscriptionOfferInBackground(history._id);

    return {
      success: true,
      message: 'Notification processing started',
      historyId: history._id
    };
  }

  // Background processing for subscription offers
  async processSubscriptionOfferInBackground(historyId) {
    try {
      const history = await AdminNotificationHistory.findById(historyId);
      if (!history) return;

      history.startedAt = new Date();
      await history.save();

      // Get all active users
      const userQuery = {
        permanentlyDeleted: { $ne: true },
        active: true
      };
      
      const totalUsers = await User.countDocuments(userQuery);
      history.totalUsers = totalUsers;
      await history.save();

      let processed = 0;
      let failed = 0;

      while (processed < totalUsers) {
        const users = await User.find(userQuery)
          .select('_id deviceToken fullName')
          .skip(processed)
          .limit(this.batchSize)
          .lean();

        const batchPromises = users.map(async (user) => {
          try {
            // Create notification
            await Notification.create({
              user: user._id,
              title: history.title,
              message: history.message,
              pic: '', // No image for subscription offers
              type: 'subscription_offer',
              referenceId: null
            });

            // Send push notification
            if (user.deviceToken) {
              await sendFirebaseNotification(
                user.deviceToken,
                history.title,
                history.message
              );
            }

            return { success: true };
          } catch (error) {
            console.error(`Failed for user ${user._id}:`, error.message);
            return { success: false };
          }
        });

        const results = await Promise.allSettled(batchPromises);
        
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            processed++;
          } else {
            failed++;
            processed++;
          }
        });

        history.processedUsers = processed;
        history.failedCount = failed;
        await history.save();

        if (processed < totalUsers) {
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
        }
      }

      history.status = 'completed';
      history.completedAt = new Date();
      await history.save();

    } catch (error) {
      console.error('Error processing notification:', error);
      await AdminNotificationHistory.findByIdAndUpdate(historyId, {
        status: 'failed',
        error: error.message
      });
    }
  }

  // Check and send profile match notifications
  async checkAndSendMatchNotifications() {
    try {
      // Get users with complete profiles
      const users = await User.find({
        profileStatus: 'Complete',
        permanentlyDeleted: { $ne: true },
        active: true
      }).limit(100); // Process 100 users at a time

      for (const user of users) {
        const preferences = await PartnerPreferences.findOne({ user_id: user._id });
        if (!preferences) continue;

        // Build match query
        const matchQuery = {
          _id: { $ne: user._id },
          permanentlyDeleted: { $ne: true },
          profileStatus: 'Complete',
          gender: user.profile_for === 'self' ? (user.gender === 'Male' ? 'Female' : 'Male') : user.gender,
          dob: {
            $gte: new Date(new Date().getFullYear() - preferences.max_age - 1, 0, 1),
            $lte: new Date(new Date().getFullYear() - preferences.min_age, 11, 31)
          },
          heightInCm: {
            $gte: preferences.min_height_in_cm,
            $lte: preferences.max_height_in_cm
          },
          marital_status: preferences.marital_status,
          religion: preferences.religion
        };

        if (!preferences.any_caste && user.caste) {
          matchQuery.caste = user.caste;
        }

        // Find one potential match
        const match = await User.findOne(matchQuery)
          .select('fullName profile_image deviceToken');

        if (match) {
          // Check if notification already sent for this match
          const existingNotification = await Notification.findOne({
            user: user._id,
            type: 'profile_match',
            referenceId: match._id,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Within last 30 days
          });

          if (!existingNotification) {
            // Create notification
            await Notification.create({
              user: user._id,
              title: '💝 New Match Found!',
              message: `${match.fullName} matches your partner preferences!`,
              pic: match.profile_image?.[0] || '', // First image only
              type: 'profile_match',
              referenceId: match._id
            });

            // Send push notification
            if (user.deviceToken) {
              await sendFirebaseNotification(
                user.deviceToken,
                '💝 New Match Found!',
                `${match.fullName} matches your partner preferences!`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking matches:', error);
    }
  }

  // Check subscription expiry
  async checkSubscriptionExpiry() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      threeDaysLater.setHours(23, 59, 59, 999);

      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      sevenDaysLater.setHours(23, 59, 59, 999);

      const expiringSubscriptions = await UserSubscription.find({
        status: 'active',
        $or: [
          { endDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 86400000) } },
          { endDate: { $gte: threeDaysLater, $lt: new Date(threeDaysLater.getTime() + 86400000) } },
          { endDate: { $gte: sevenDaysLater, $lt: new Date(sevenDaysLater.getTime() + 86400000) } }
        ]
      }).populate('userId', 'fullName deviceToken');

      for (const subscription of expiringSubscriptions) {
        if (!subscription.userId) continue;

        const daysUntilExpiry = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
        let message = '';

        if (daysUntilExpiry === 1) {
          message = `Hi ${subscription.userId.fullName}, your subscription expires tomorrow! Renew now to keep enjoying premium features.`;
        } else if (daysUntilExpiry === 3) {
          message = `Hi ${subscription.userId.fullName}, your subscription expires in 3 days. Renew now to avoid interruption.`;
        } else if (daysUntilExpiry === 7) {
          message = `Hi ${subscription.userId.fullName}, your subscription expires in 7 days. Renew early and save!`;
        }

        await Notification.create({
          user: subscription.userId._id,
          title: '⏰ Subscription Expiring Soon',
          message,
          pic: '',
          type: 'subscription_expiry',
          referenceId: null
        });

        if (subscription.userId.deviceToken) {
          await sendFirebaseNotification(
            subscription.userId.deviceToken,
            '⏰ Subscription Expiring Soon',
            message
          );
        }
      }
    } catch (error) {
      console.error('Error checking subscription expiry:', error);
    }
  }

  // Send profile incomplete reminders
  async sendProfileReminders() {
    try {
      const incompleteUsers = await User.find({
        profileStatus: 'Incomplete',
        permanentlyDeleted: { $ne: true },
        created_at: {
          $lte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }).select('_id fullName deviceToken').limit(1000);

      for (const user of incompleteUsers) {
        const message = `Hi ${user.fullName || 'there'}, complete your profile to get 5x more matches!`;

        await Notification.create({
          user: user._id,
          title: '📝 Complete Your Profile',
          message,
          pic: '',
          type: 'profile_incomplete',
          referenceId: null
        });

        if (user.deviceToken) {
          await sendFirebaseNotification(
            user.deviceToken,
            '📝 Complete Your Profile',
            message
          );
        }
      }
    } catch (error) {
      console.error('Error sending profile reminders:', error);
    }
  }
}

module.exports = new NotificationService();