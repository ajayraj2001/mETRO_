// cronJobs.js
const cron = require('node-cron');
const notificationService = require('./notificationService');

// Check subscription expiry daily at 10 AM
cron.schedule('0 10 * * *', async () => {
  console.log('Checking subscription expiries...');
  await notificationService.checkSubscriptionExpiry();
});

// Send profile reminders every Monday, Wednesday, Friday at 11 AM
cron.schedule('0 11 * * 1,3,5', async () => {
  console.log('Sending profile reminders...');
  await notificationService.sendProfileReminders();
});

// Check for profile matches daily at 2 PM
cron.schedule('0 14 * * *', async () => {
  console.log('Checking for profile matches...');
  await notificationService.checkAndSendMatchNotifications();
});

// Clean up old notifications monthly
cron.schedule('0 0 1 * *', async () => {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const result = await Notification.deleteMany({
      isRead: true,
      createdAt: { $lt: threeMonthsAgo }
    });

    console.log(`Cleaned up ${result.deletedCount} old notifications`);
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
  }
});