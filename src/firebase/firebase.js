
const admin = require('firebase-admin');
const serviceAccount = require('./perfect-jodi-c9fe3-firebase-adminsdk-wvnce-42e1b0d5ee.json'); // Download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;