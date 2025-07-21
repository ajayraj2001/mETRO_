const admin = require('../firebase/firebase');

const sendFirebaseNotification = async (token, title, body, _id, type, pic) => {
  const message = {
    notification: { title, body },
    data: { _id, type, pic },
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent:', response, type, 'type');
    return response;
  } catch (error) {
    console.error('❌ FCM Error:', error?.message || error);
    return null;
  }
};

// // // Test it directly
// async function testNotification() {
//   const deviceToken = 'ekVE_b6MQ9uiYaEFvEfqoI:APA91bHKvoDCmtfI2yj7nHS3Dk6wx89cSAGaPhn_ZFh_LndQeMs51ZXSyxcx-JPbKozGUuquzOJhW5AH1hdICUIrlvxwo_Fq6jk1tw0d67k3ewCqdfVAF5s';
//   const fullName = "RADHA RANI Raj";

//   await sendFirebaseNotification(
//     deviceToken,
//     "Connection Request Accepted",
//     `${fullName} has accepted your connection request`,
//     "685a90c7119b6058b0940a6e",
//     'profile',
//     'public/user/1752051992891-638931146.jpg'
//   );
// }

// testNotification();

module.exports = sendFirebaseNotification;
