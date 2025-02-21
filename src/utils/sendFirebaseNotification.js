const admin = require('../firebase/firebase');

const sendFirebaseNotification = async (token, title, body) => {
  const message = {
    notification: {
      title: title,
      body: body,
    },
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

// Example usage
// const userToken = 'f7ie3FGuRSKiaq51Hm4jiV:APA91bEMjtasnVkBAzeK0OA_Rwq5L5WKTf50_wwlgHZhEjgMVjD_Fg4gvo6AczX4rV-62LUb__FefrY0cZH4v6e0BAy9Bs2ESZ3AZqj6tqbixkuqIQEmxdE'; // Replace with your device's FCM token
// sendFirebaseNotification(userToken, 'Purchase', 'You have successfully purchased a subscription.');

module.exports = sendFirebaseNotification;