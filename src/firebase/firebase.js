
const admin = require('firebase-admin');
const serviceAccount = require('./jodi4ever-951ec-firebase-adminsdk-fbsvc-6522b146e9.json'); // Download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;